from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import VoiceParseRequest, VoiceParseResponse, VoiceExecuteRequest, SaleCreate, PurchaseCreate
from ..voice_parser import parse_voice_command
from ..crud import create_sale, create_purchase, delete_sale, get_last_sale, get_today_summary, get_item_by_id

router = APIRouter(prefix="/api/voice", tags=["Voice Entry"])

@router.post("/parse", response_model=VoiceParseResponse)
def parse_voice(request: VoiceParseRequest, user_id: int = 1, db: Session = Depends(get_db)):
    """
    Parses vendor speech in Tamil or English into structured action JSON.
    Returns: {action, item, quantity, unit, amount, spoken_confirmation_en, spoken_confirmation_ta}
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Voice text cannot be empty")

    result = parse_voice_command(db, request.text, user_id=user_id)
    return result

@router.post("/execute")
def execute_voice_action(req: VoiceExecuteRequest, user_id: int = 1, db: Session = Depends(get_db)):
    """
    Executes a parsed voice action (saves sale or purchase, or cancels last sale).
    """
    if req.action == "sale":
        if not req.item_id or not req.amount:
            raise HTTPException(status_code=400, detail="item_id and amount are required for sale")
        
        sale_in = SaleCreate(
            user_id=user_id,
            item_id=req.item_id,
            quantity=req.quantity or 1.0,
            unit=req.unit or "kg",
            amount=req.amount,
            voice_raw_text=req.raw_text
        )
        saved_sale = create_sale(db, sale_in)
        item = get_item_by_id(db, req.item_id)
        summary = get_today_summary(db, user_id=user_id)

        item_en = item.name_en if item else "Item"
        item_ta = item.name_ta if item else "பொருள்"

        return {
            "status": "success",
            "action": "sale",
            "record_id": saved_sale.id,
            "spoken_confirmation_en": f"Recorded sale: {saved_sale.quantity:g} {saved_sale.unit} {item_en} for ₹{saved_sale.amount:.0f}. Today's profit is ₹{summary['net_profit']:.0f}.",
            "spoken_confirmation_ta": f"{saved_sale.quantity:g} {saved_sale.unit} {item_ta} ₹{saved_sale.amount:.0f}-க்கு பதிவு செய்யப்பட்டது. இன்றைய லாபம் ₹{summary['net_profit']:.0f}.",
            "today_summary": summary
        }

    elif req.action == "purchase":
        if not req.item_id or not req.amount:
            raise HTTPException(status_code=400, detail="item_id and amount are required for purchase")

        purchase_in = PurchaseCreate(
            user_id=user_id,
            item_id=req.item_id,
            quantity=req.quantity or 1.0,
            unit=req.unit or "kg",
            total_cost=req.amount,
            notes=f"Voice recorded: {req.raw_text}" if req.raw_text else None
        )
        saved_p = create_purchase(db, purchase_in)
        item = get_item_by_id(db, req.item_id)
        summary = get_today_summary(db, user_id=user_id)

        item_en = item.name_en if item else "Item"
        item_ta = item.name_ta if item else "பொருள்"

        return {
            "status": "success",
            "action": "purchase",
            "record_id": saved_p.id,
            "spoken_confirmation_en": f"Recorded purchase: {saved_p.quantity:g} {saved_p.unit} {item_en} for ₹{saved_p.total_cost:.0f}.",
            "spoken_confirmation_ta": f"{saved_p.quantity:g} {saved_p.unit} {item_ta} ₹{saved_p.total_cost:.0f}-க்கு பதிவு செய்யப்பட்டது.",
            "today_summary": summary
        }

    elif req.action == "undo":
        last_s = get_last_sale(db, user_id=user_id)
        if not last_s:
            return {
                "status": "no_op",
                "spoken_confirmation_en": "No recent sales found to cancel.",
                "spoken_confirmation_ta": "ரத்து செய்ய எந்த விற்பனையும் இல்லை."
            }
        item_en = last_s.item.name_en if last_s.item else "Item"
        item_ta = last_s.item.name_ta if last_s.item else "பொருள்"
        amt = last_s.amount
        qty = last_s.quantity
        unit = last_s.unit
        delete_sale(db, last_s.id)
        summary = get_today_summary(db, user_id=user_id)

        return {
            "status": "success",
            "action": "undo",
            "spoken_confirmation_en": f"Cancelled sale of {qty:g} {unit} {item_en} (₹{amt:.0f}). Remaining profit: ₹{summary['net_profit']:.0f}.",
            "spoken_confirmation_ta": f"{qty:g} {unit} {item_ta} (₹{amt:.0f}) விற்பனை ரத்து செய்யப்பட்டது. தற்போதைய லாபம் ₹{summary['net_profit']:.0f}.",
            "today_summary": summary
        }

    else:
        return {"status": "info", "action": req.action}

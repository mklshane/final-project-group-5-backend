import { receiptService } from "../services/receipt.service.js";

export async function handleParseReceipt(req, res) {
  const parsed = await receiptService.parseReceiptImage(req.body);
  res.json(parsed);
}

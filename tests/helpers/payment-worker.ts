import { BookingService } from "../../server/bookings";
import { openDatabase } from "../../server/database";
import { DomainError } from "../../server/errors";

const [filename, parentId, bookingId, key] = process.argv.slice(2);
if (!filename || !parentId || !bookingId || !key)
  throw new Error("Missing worker arguments");
const db = openDatabase(filename);
const service = new BookingService(db);
process.on("message", () => {
  try {
    console.log(
      JSON.stringify(
        service.recordPayment(parentId, bookingId, key, "succeeded"),
      ),
    );
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    console.log(JSON.stringify({ error: error.code }));
  } finally {
    db.close();
    process.exit(0);
  }
});
process.send?.("ready");

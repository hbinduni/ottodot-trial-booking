import { databasePath } from "./config";
import { migrate, openDatabase } from "./database";
import { seed } from "./seed";

const filename = databasePath();
const db = openDatabase(filename);
try {
  migrate(db);
  if (process.argv.includes("--reset")) {
    db.transaction(() => {
      db.exec(
        "DELETE FROM payment_attempts; DELETE FROM bookings; DELETE FROM students; DELETE FROM trial_classes; DELETE FROM parents; DELETE FROM app_meta;",
      );
      seed(db);
    }).immediate();
    console.log(`Reset synthetic demo data: ${filename}`);
  } else {
    seed(db);
    console.log(`Synthetic demo data ready: ${filename}`);
  }
} finally {
  db.close();
}

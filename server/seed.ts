import type { Database } from "bun:sqlite";

export function seed(db: Database): void {
  db.transaction(() => {
    if (db.query("SELECT 1 FROM app_meta WHERE key = 'seed_version'").get())
      return;
    const parents = [
      ["parent-amy", "Amy Chen"],
      ["parent-ben", "Ben Lim"],
      ["parent-seed", "Sample family"],
    ] as const;
    for (const [id, name] of parents)
      db.run("INSERT INTO parents (id, name) VALUES (?, ?)", [id, name]);
    const students = [
      ["student-ava", "parent-amy", "Ava"],
      ["student-leo", "parent-amy", "Leo"],
      ["student-ben", "parent-ben", "Noah"],
      ["student-mia", "parent-seed", "Mia"],
      ["student-eli", "parent-seed", "Eli"],
      ["student-zoe", "parent-seed", "Zoe"],
    ] as const;
    for (const row of students)
      db.run("INSERT INTO students (id, parent_id, name) VALUES (?, ?, ?)", [
        ...row,
      ]);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 7);
    start.setUTCHours(9, 0, 0, 0);
    db.run(
      "INSERT INTO trial_classes (id, title, subject, starts_at) VALUES (?, ?, ?, ?)",
      ["class-space", "Space explorers", "Science", start.toISOString()],
    );
    start.setUTCDate(start.getUTCDate() + 1);
    db.run(
      "INSERT INTO trial_classes (id, title, subject, starts_at) VALUES (?, ?, ?, ?)",
      ["class-fractions", "Fun with fractions", "Math", start.toISOString()],
    );
    const bookings = [
      ["booking-mia", "student-mia", "class-fractions", "confirmed"],
      ["booking-eli", "student-eli", "class-fractions", "confirmed"],
      ["booking-zoe", "student-zoe", "class-fractions", "confirmed"],
      ["booking-space-mia", "student-mia", "class-space", "confirmed"],
      ["booking-failed", "student-leo", "class-fractions", "payment_failed"],
    ] as const;
    for (const [id, studentId, classId, bookingStatus] of bookings) {
      db.run(
        "INSERT INTO bookings (id, student_id, class_id, status) VALUES (?, ?, ?, ?)",
        [id, studentId, classId, bookingStatus],
      );
      db.run(
        "INSERT INTO payment_attempts (id, booking_id, idempotency_key, outcome, resulting_status) VALUES (?, ?, ?, ?, ?)",
        [
          `attempt-${id}`,
          id,
          `seed-${id}`,
          bookingStatus === "confirmed" ? "succeeded" : "failed",
          bookingStatus,
        ],
      );
    }
    db.run("INSERT INTO app_meta (key, value) VALUES ('seed_version', '1')");
  }).immediate();
}

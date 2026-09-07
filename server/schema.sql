CREATE TABLE parents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
) STRICT;

CREATE TABLE students (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id),
  name TEXT NOT NULL
) STRICT;

CREATE TABLE trial_classes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4 CHECK (capacity = 4)
) STRICT;

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  class_id TEXT NOT NULL REFERENCES trial_classes(id),
  status TEXT NOT NULL CHECK (status IN ('pending_payment', 'confirmed', 'payment_failed', 'refund_required')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (student_id, class_id)
) STRICT;

CREATE INDEX bookings_class_status ON bookings(class_id, status);

CREATE TABLE payment_attempts (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'failed')),
  resulting_status TEXT NOT NULL CHECK (resulting_status IN ('confirmed', 'payment_failed', 'refund_required')),
  refund_reason TEXT CHECK (refund_reason IN ('class_full', 'class_started')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (outcome = 'failed' AND resulting_status = 'payment_failed' AND refund_reason IS NULL) OR
    (outcome = 'succeeded' AND resulting_status = 'confirmed' AND refund_reason IS NULL) OR
    (outcome = 'succeeded' AND resulting_status = 'refund_required' AND refund_reason IS NOT NULL)
  )
) STRICT;

CREATE INDEX payment_attempts_booking ON payment_attempts(booking_id);
CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;

-- Keep the invariant even if a future writer bypasses the booking service.
CREATE TRIGGER bookings_capacity_insert
BEFORE INSERT ON bookings
WHEN NEW.status = 'confirmed'
BEGIN
  SELECT RAISE(ABORT, 'CLASS_FULL')
  WHERE (SELECT COUNT(*) FROM bookings WHERE class_id = NEW.class_id AND status = 'confirmed')
    >= (SELECT capacity FROM trial_classes WHERE id = NEW.class_id);
END;

CREATE TRIGGER bookings_capacity_update
BEFORE UPDATE OF status, class_id ON bookings
WHEN NEW.status = 'confirmed'
BEGIN
  SELECT RAISE(ABORT, 'CLASS_FULL')
  WHERE (SELECT COUNT(*) FROM bookings WHERE class_id = NEW.class_id AND status = 'confirmed' AND id <> OLD.id)
    >= (SELECT capacity FROM trial_classes WHERE id = NEW.class_id);
END;

CREATE TRIGGER bookings_identity_immutable
BEFORE UPDATE OF id, student_id, class_id ON bookings
WHEN NEW.id <> OLD.id OR NEW.student_id <> OLD.student_id OR NEW.class_id <> OLD.class_id
BEGIN
  SELECT RAISE(ABORT, 'BOOKING_IDENTITY_IMMUTABLE');
END;

-- Cancellation and refund completion need explicit future transitions.
CREATE TRIGGER bookings_terminal
BEFORE UPDATE OF status ON bookings
WHEN OLD.status IN ('confirmed', 'refund_required') AND NEW.status <> OLD.status
BEGIN
  SELECT RAISE(ABORT, 'BOOKING_FINAL');
END;

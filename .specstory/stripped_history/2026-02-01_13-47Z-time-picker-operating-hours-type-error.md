
./components/reservations/time-picker.tsx:44:43
Type error: This comparison appears to be unintentional because the types '7' and '22' have no overlap.
  42 |     const increment = hourOnly ? 60 : TIME_SLOT_MINUTES;
  43 |
> 44 |     while (hour < OPERATING_HOURS.end || (hour === OPERATING_HOURS.end && minute === 0)) {
     |                                           ^
  45 |       const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  46 |       result.push(timeStr);
  47 |       
Next.js build worker exited with code: 1 and signal: null
 ELIFECYCLE  Command failed with exit code 1.
Error: Command "pnpm run build" exited with 1

---
# Auction Design Notes

## Data and recovery

PostgreSQL is the sole runtime database. `Player` stores the authoritative registration, academic classification, self-declared profile and current assignment. `AuctionState` is a singleton holding the active lot, current bid, timer, pass list, bucket minima, draw mode and round. `AuditLog` is append-oriented: actions are retained, and corrections mark a sale record as undone and add a separate `UNDO` record rather than erasing history.

Purse and squad totals are derived from current player assignments instead of maintained as incremented counters. An active sale contributes its `sold_price` to the franchise's spend; retained and referred players do not consume purse or auction-purchase slots. Auction bucket counts use auction assignments only, so free retained/referred players cannot satisfy mandatory bucket minima. Undo clears the assignment and price; purse, slots, bucket progress, maximum bid and scarcity are then recalculated from the same player rows.

## Bid validity

The legal next bid is the base price before an opening bid, then the configured increment: 10 below 100, 20 from 100 through 199, and 30 from 200 onward. The server verifies the exact next price, active timer, player eligibility, franchise pass state, squad limit and assigned Captain's franchise. Operators may record an assisted bid for a selected franchise; the actor stored in the audit record comes from the verified session, not the request body.

For a franchise with fewer than fifteen purchases, after a proposed purchase the engine computes:

- purchases remaining to fifteen;
- mandatory bucket players still needed after accounting for the proposed player's bucket;
- slots required as the larger of those two values;
- purse reserve as required slots multiplied by the minimum price of 20.

The bid ceiling is current purse minus that reserve. At fifteen or more purchases, remaining mandatory bucket slots are still reserved, and a purchase outside an unmet bucket is rejected if it would leave no slot to fill the requirement. Once the minimum purchase and bucket requirements are met, extra purchases are allowed subject to the purse and 22-player squad cap.

The singleton auction-state row is selected `FOR UPDATE` for a bid. Price, bidder, timer reset and audit entry are committed in one database transaction, which serializes concurrent bids. Timer expiry only stops bidding; only the hammer records a sale.

## Scarcity and auction progression

For each bucket, scarcity compares paid, unassigned supply with the total number of players all franchises still need, not merely the number of franchises. It is informational and never blocks an otherwise legal bid. The default bucket order is B3, B4, B2, B5, B1, then PG; draw numbers are unique within each bucket. Auto mode selects the next available number. Guest mode waits for the operator to enter a number from the active bucket. Manually skipped players are recalled once at the end of their bucket; unsold players carry into Round 2 at a base price of 20.

At Round 2 completion, Super Admin auto-allotment assigns available paid players at 20 credits to unmet bucket and purchase requirements, prioritizing the franchise with most unfilled requirements and then smallest purse. If the specific bucket is exhausted, Super Admin may scout a verified, paid player for 20 credits. Both paths create explicit audit records and expose `allotted`/`scouted` types to the public squad view.

## Operational boundaries

The public API response schemas omit player, CricHeroes and franchise phone numbers. Administrative responses are protected by role middleware. Super Admin-only actions include undo, direct assignment, minimum relaxation, auto-allotment and scouting; Operators can run the lot and place assisted bids but cannot change those settings.

The current implementation is not yet a complete production operations platform. Login accounts are configured statically through `AUCTION_AUTH_USERS`; there is no mobile OTP/franchise account provisioning. Player self-service edits and global/per-player edit locks are not yet implemented. Tournament editions are not separately partitioned, backups are not automated, and the WebSocket manager is process-local, so deploy one backend worker. Offline bid queuing, the Round 2 player/bucket request queue, and end-of-round captain recalls remain follow-up work. Export is manual through the authenticated spreadsheet endpoint.

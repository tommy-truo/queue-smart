# QueueSmart Smart Queue Reminders

## What makes the feature smart

QueueSmart combines a customer's chosen lead time with the current queue order, expected service duration, and elapsed time of the customer being served. It recalculates instead of setting a fixed timer when someone joins. This gives customers time to prepare or return while reducing the need to keep checking their position.

The feature uses rules and the existing queue data; it does not require an AI API or machine learning.

## Customer experience

- Join a service and choose 5, 10, or 15 minutes before service; the default is 10.
- View a live estimated countdown on Join Queue, Queue Status, or the dashboard.
- Change the preference on Queue Status while waiting.
- When the estimate reaches the threshold, receive a saved notification and a visible banner across customer pages.
- Dismiss the banner; the notification remains in history and is marked viewed.
- Receive the separate “It's your turn” notification when staff call the customer.

Example: “Get ready for IT Support. Your estimated wait is about 5 minutes.” Service-specific instructions are appended when configured.

## Timing rules

For a waiting customer:

```text
estimated wait = remaining expected time of the current service
               + number of waiting customers ahead × expected duration
```

Only the active service portion counts down. If nobody is being served, the estimate stays unchanged until staff act. If the active service exceeds its expected duration, its remaining estimate is floored at zero and the UI explicitly reports the delay; other waiting customers still contribute their full expected durations. Actual service times can vary. When the estimate reaches zero and staff still need to act, the display explains what the customer is waiting for.

The backend checks at startup and every 30 seconds, independently of customer requests. Joining, leaving, removal, serving, priority assignment, reordering, and expected-duration changes also reevaluate affected reminders. A preference change evaluates the new threshold immediately. A reminder is delivered on the first check at or below the threshold, so it may arrive after the exact threshold crossing. The open app displays it on its next five-second queue refresh.

One reminder is sent per waiting period. Joining within the threshold triggers one immediately. Changing the threshold after delivery does not resend. Calling, serving, leaving, or removing someone stops advance reminders for that waiting period. Requeue preserves the preference but resets sent/dismissed state, allowing a fresh reminder; if already within the threshold, the new reminder is immediate.

## Integration and persistence

SQLite schema version 4 adds the preference, sent timestamp, linked notification, original lead time and wait estimate, and dismissal state to each queue entry. Existing entries default to 10 minutes. Claiming an unsent reminder and saving its notification happen in the same transaction, preventing duplicate alerts and allowing retry if storage fails.

Only the signed-in customer can change their own preference or dismiss their own reminder. Updates include the current entry ID so a stale tab cannot alter a newly joined visit. Dismissals include the notification ID so an old banner cannot dismiss a reminder from a later requeue period.

Notifications use the existing Notification table and customer notification list. The global customer banner uses the queue refresh flow, and the preference controls use authenticated queue endpoints. Restart reloads saved state and checks overdue reminders without repeating those already sent.

The backend must remain running. Closing the customer browser does not stop reminder creation; the saved alert appears on return. There is no email, SMS, or external push delivery.

## Live demo

1. As administrator, create a service with an expected duration of **6 minutes**.
2. Join with customer A, then use staff controls to call A for service.
3. Join with customer B and select a **5-minute reminder**. B's initial estimate is about 6 minutes, so the advance reminder is pending.
4. Show B's live countdown. Present another part of the application while roughly one minute passes.
5. Without another staff action, show the reminder banner and saved notification after the threshold is crossed. Allow up to approximately **95 seconds after A was called**, accounting for the 30-second worker and five-second UI refresh.
6. Dismiss the banner and show that the notification remains saved. Change the preference and confirm no duplicate is sent.
7. Call B, show “It's your turn,” then put B back in line to demonstrate a fresh reminder period.

The HTTP smoke test verifies the same timing behavior in a disposable database. It adjusts only its test customer's service timestamp, then waits for a real worker tick with no customer request or staff action before checking the result. It also restarts the API to verify the preference, notification identity, and dismissal persist without resending.

## Review findings addressed

- Counting down the whole queue would incorrectly imply waiting customers were already being served. Both server and display retain the waiting-time floor.
- Existing position alerts would duplicate the new advance warning. They are replaced by the timed reminder while keeping the positional badge and actual-turn message.
- Requeue could accidentally retain a dismissed reminder or issue repeated alerts. It starts one new waiting period and new notification identity.
- Old tabs could edit a later visit or dismiss a new reminder. The endpoints check the entry or notification identity.
- A countdown inside a live announcement could interrupt screen-reader users every second. Only the reminder message is announced; the ticking estimate is outside that region.
- Notification storage could fail after a claim. A transaction rolls back both operations so the next check can retry.

Automated backend, component, migration, worker, and HTTP tests cover these behaviors. The November 20 Chrome walkthrough verified the customer join, preference edit, banner dismissal across reload, and saved notification. The HTTP crawl verified timed delivery and restart persistence.

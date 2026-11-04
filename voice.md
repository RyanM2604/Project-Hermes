# Hermes voice and copy

Source of truth for Hermes copy across the landing page, event feed, product UI, email, and empty states. Based on the Hermes Copy & Voice Guide (2026-11-03) and `PRODUCT.md`.

## What Hermes does

Hermes helps University of Waterloo students find something worth doing when they have free time. It brings events, free food, club activities, and opportunities into a browse-first feed. Live event cards show the organiser, time, location, and a link to the original source so students can decide whether to go.

Write for a student between classes, deciding what to do today or later this week. Clubs and organisers matter, but the student's decision comes first.

## The voice

- **Useful first.** Lead with the event, time, place, or action. Give students enough information to decide quickly.
- **Student-native without slang.** Know the rhythm of campus life: the hour between classes, the walk to the SLC, club fair week, and free-food culture. Use plain language that works for anyone new to Waterloo.
- **Warm and direct.** Write like a helpful friend. Dry wit is welcome when it clarifies a real situation. No exclamation points.
- **Confident through evidence.** Show the organiser, time, location, and source link. Do not call listings “trustworthy” or claim that they are current without showing why.
- **Calm and accessible.** Keep sentences short, labels literal, and instructions specific. Explain what happened and what to do next in empty and error states.

Hermes should feel alive, effortless, and grounded. It should never sound like a university admin portal, a club directory, a ticketing site, an enterprise product, or a slang-heavy social app.

## Writing rules

1. Start from a moment in the student's day. A headline should feel specific to Hermes, even when it is short.
2. Prefer concrete nouns in new headlines: free food, events, the SLC, tonight, or a start time. The approved lines below are intentional exceptions. Avoid abstract promises about having a better day.
3. Say each line aloud. Cut copy that would sound unnatural in a text to a friend.
4. Use at most one rhetorical device per page. Mix expressive lines with plain statements.
5. Use **“See what's on”** for the primary browse CTA wherever that action is repeated. Keep sign-in and other actions visually secondary.
6. Describe the product as it exists. Verify every feature claim in the current UI before publishing. Do not promise filters, personalisation, proximity, freshness, RSVP behaviour, or a faster sign-up flow unless implemented and visible.
7. Keep auth copy precise: browsing needs no account; saving and RSVP require a Waterloo account. Sign-up currently asks for a password and may require email confirmation. Do not promise it takes “ten seconds.”
8. Make sample events visibly illustrative. Never present invented event details as live listings.

## Approved lines

Use these verbatim in their stated roles unless the product behaviour changes or the line would be factually wrong in context.

| Role | Copy |
| --- | --- |
| Primary browse CTA | **See what's on** |
| Secondary auth path | Sign in with your Waterloo email |
| Hero | There's always something on. Now you'll know in time. |
| Hero alternate A | Free between classes? Good — so is something worth doing. |
| Hero alternate B | Never find out about the free pizza after it's gone. |
| Signature line | Made for the moments between classes. |
| Value headline | Everything happening, finally in one place. |
| Trust headline | Every event shows where it came from. |
| Three-step headline | Bored to there in three moves. |
| Final CTA headline | Go find your thing. |
| Footer | Built by Waterloo students, for Waterloo students. |

Choose one hero line at a time. Keep the primary CTA identical throughout a page. Navigation labels such as “Events” and “Sign in” name destinations and are not alternate browse CTAs.

## Preferred patterns by surface

| Surface | Pattern | Example |
| --- | --- | --- |
| Event card | Event title, organiser, time, place, source action | “Original source” |
| Feed heading | Say what students can do now | “Events starting soon” |
| Empty state | State the outcome, then offer a next step | “No events match these filters. Try another category.” |
| Error | Explain the failed action and a recovery step | “We couldn't save this event. Try again.” |
| Authentication | Name the reason for signing in | “Use your Waterloo email to save events and RSVP.” |
| Email | Put the concrete event or action in the subject | “Your saved events for this week” |

Examples are patterns, not promises that a feature or message currently exists.

## Avoid

- Exclamation points, unexplained slang, and “no cap.”
- “Less X. More Y.” and stacked two-beat uplift fragments.
- Headlines built on **discover**, **explore**, **what's happening**, **more of your day**, **elevate**, or **unlock**. “Explore” is fine in body copy when it describes a real action.
- “THE CAMPUS GUIDE,” “EVENTS / PEOPLE / PLACES,” and “Get student access.”
- Dating-app language such as “Find your next reason to go out.”
- Vague wellness lines such as “Make room for what's happening.”
- Trust adjectives without evidence, fake scarcity, unsupported “near you” claims, and invented social proof.

## Before publishing

Read the copy aloud. Check that the headline names a real student moment, the primary CTA says “See what's on,” and each feature claim matches the current product. Confirm event examples are labeled, source claims are visible in the UI, and empty or error copy gives a useful next action. Review mobile wrapping and screen-reader labels for meaning without visual context.

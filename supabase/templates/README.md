# Hermes auth email

**Subject:** Confirm your email for Hermes

In Supabase, open **Authentication → Emails → Confirm sign up**. Set the subject above and paste all of `confirmation.html` into the HTML body, then save.

Keep both `{{ .ConfirmationURL }}` placeholders intact: Supabase supplies the verification link for each recipient. The logo uses the public Hermes website; the wordmark and all copy remain readable with images blocked.

The email inherits the existing Hermes palette and 4px button corners. Georgia and Arial are deliberate email-safe fallbacks for Fraunces and DM Sans; no web fonts are required. The Arial design-detector exception is recorded in `.impeccable/config.json`; the website design system is unchanged.

This creates the template locally. It does not change the Supabase dashboard, SMTP settings, or send an email. Preview screenshots show browser rendering; Gmail, Apple Mail, and Outlook should also be checked with a test signup before rollout.

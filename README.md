# Pulumutsa Moyo (proof of concept)

*Pulumutsa Moyo* means "Save a life" in Nyanja.

An independent prototype of a blood donor app for Zambia, prepared for a pilot with the Zambia National Blood Transfusion Service (ZNBTS). It is not yet an official ZNBTS app.

Live site: https://zachlindeque-art.github.io/ZNBS-App-/

## What it does
- **Sign-up on first launch**: name, phone, email, sex, blood group, how the person donates, and reminder preferences (in the app, SMS, email) with consent
- **Donor card**: profile, donation history by type (whole blood, platelets, plasma) and totals
- **Next donation date** worked out from the donation type and sex:
  - Whole blood: men every 3 months, women every 4 months
  - Platelets and plasma: every 2 weeks (to be confirmed by ZNBTS)
- **Reminders**: calendar file, Google Calendar and browser notifications. SMS and email are collected for the pilot but not sent yet; that needs a small server.
- **Map** of the towns where ZNBTS runs provincial blood centres, with directions
- **Before you donate**: ways to donate, eligibility, food, aftercare and when to check with the team
- **Bring a friend**: share the app on WhatsApp or copy the link
- English, Icibemba and Chinyanja

The whole app is one file, `index.html`. All data is stored only in the visitor's browser.

## Changes from the ZNBTS meeting (November 2026)
- Added the sign-up screen and donor profile
- Added donation types with their own waiting times
- Turned the reminder page into a donor card with history by type
- Added SMS and email reminder preferences with consent
- Expanded the health information (ways to donate, iron-rich food, vaccinations)
- Added "Bring a friend" sharing to help mobilise donors

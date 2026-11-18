# Pulumutsa Moyo (proof of concept)

*Pulumutsa Moyo* means "Save a life" in Nyanja. It is an independent prototype of a blood donor app for Zambia, built for a pilot with the Zambia National Blood Transfusion Service (ZNBTS). It is not yet an official ZNBTS app.

Live site: https://zachlindeque-art.github.io/ZNBS-App-/

## What it does
- **Language choice on the first screen**: English, Icibemba or Chinyanja
- **Sign-up**: name, phone, email, sex, blood group, what the person gives, and reminder preferences (in the app, SMS, email) with consent
- **Donor card**: profile, history and totals by donation type, and a picture of the card with a QR code that donors can save to their gallery
- **Next donation date** worked out from the donation type and sex:
  - Whole blood: men every 3 months, women every 4 months
  - Platelets and plasma: every 2 weeks (to be confirmed by ZNBTS)
- **Reminders**: calendar file (.ics), Google Calendar and browser notifications. SMS and email preferences are collected for the pilot but nothing is sent yet; that needs a small server.
- **Map** of ZNBTS blood centres with directions. Lusaka is placed at UTH on Nationalist Road; the other pins mark the town until ZNBTS confirms addresses.
- **Your visit**: what happens at a centre, step by step
- **Where your blood goes**: ZNBTS figures from the Ama Hero campaign
- **Before you donate**: ways to donate, eligibility, food, aftercare and when to check with staff first
- **Don't come alone**: share the app on WhatsApp or copy the link

## Project layout
```
index.html              Page markup (English text built in, so it reads before scripts load)
manifest.webmanifest    Lets phones install the app to the home screen
css/styles.css          All styles: colours, layout, the chitenge band
css/leaflet.css         Map library styles
js/i18n.js              Every piece of text in English, Icibemba and Chinyanja
js/data.js              Blood centres, towns, donation waiting times, Zambia's border
js/app.js               App logic: sign-up, donor card, reminders, map, card picture
js/vendor/leaflet.js    Map library (Leaflet 1.9.4)
js/vendor/qrcode.js     QR code library (qrcode-generator 1.4.4)
icons/                  Home screen icons
```

**To fix a translation**, edit `js/i18n.js`. Every language uses the same keys; change only the text in quotes and keep any `{words in brackets}`.

**To change a waiting time or add a centre**, edit `js/data.js`.

All data stays in the visitor's browser. Nothing is sent to a server.

## Still to confirm with ZNBTS
- Waiting time for platelets and plasma
- Exact addresses, phone numbers and opening hours for each centre (the Lusaka head office number is from a 2015 ZNBTS document)
- Bemba and Nyanja wording

## History
- **October 2026**: first prototype with map, reminders and three languages
- **November 2026**: changes after meeting ZNBTS: sign-up, donation types, donor card, SMS and email preferences, more health information, invite a friend
- **November 2026**: renamed to Pulumutsa Moyo; language choice on the first screen; real Lusaka centre details; visit timeline; donor card picture with QR code; code split into separate files

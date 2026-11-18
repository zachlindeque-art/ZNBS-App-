# Pulumutsa Moyo

Pulumutsa Moyo ("Save a life" in Nyanja) is a prototype blood donor app for Zambia. We're building it for a pilot with the Zambia National Blood Transfusion Service (ZNBTS). It isn't an official ZNBTS app yet.

Live: https://zachlindeque-art.github.io/ZNBS-App-/

Donors pick a language (English, Icibemba or Chinyanja), set up a donor card and log each donation. The app works out when they can give again: 3 months after whole blood for men, 4 months for women, and 2 weeks after platelets or plasma. It can put the reminder in their calendar, and the card can be saved as a picture with a QR code that friends can scan.

There's also a map of the ten provincial blood centres. "Use my location" sorts them by distance.

## Pages

- `start.html`: language and sign-up
- `index.html`: home
- `find.html`: map and list of centres
- `card.html`: donor card, history and reminders
- `info.html`: who can give, how to prepare and what happens on the day

## Files

- `js/i18n.js`: all the text, in three languages. To fix a word, change the text in quotes and leave anything in `{brackets}` alone.
- `js/data.js`: centres, towns and waiting times
- `js/app.js`: everything the pages do
- `css/styles.css`: styles
- `js/vendor/`: Leaflet 1.9.4 for the map, qrcode-generator 1.4.4 for the QR code

Everything a donor enters stays in their own browser. Nothing is sent anywhere yet. SMS and email reminders will need a small server for the pilot.

## Still to confirm with ZNBTS

- Waiting time for platelets and plasma
- Addresses and phone numbers for each centre. We have Lusaka (UTH, Nationalist Road) and Kitwe (Kitwe Teaching Hospital). Kabwe is listed at Kabwe General Hospital in a business directory. The Lusaka number is from 2015.
- The Bemba and Nyanja wording

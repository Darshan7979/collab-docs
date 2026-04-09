Firebase quick setup (for frontend/firebase.js)

1) Go to https://console.firebase.google.com
2) Create a project
3) In Build -> Authentication -> Get started
4) Enable Email/Password sign-in provider
5) Project Settings -> Your apps -> Add Web app
6) Copy config values and paste into frontend/firebase.js

Important:
- Add your frontend origin to Authentication authorized domains.
- Example: localhost, 127.0.0.1, or your static server host.

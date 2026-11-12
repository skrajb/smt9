/* ============================================================
   Buy / Renew prices shown on the Dashboard (header button "Buy / Renew").
   EDIT THIS FILE to change what students see. Nothing else needs touching.

   code      : activation product code (ENG / PBI / HIN) - used to show the
               student's current status (Active / days left / Not activated)
   name      : course name shown on the row
   buy       : first-time price (text, so you can write "Rs. 1,500")
   renew     : renewal price
   validity  : how long one purchase / renewal lasts
   note      : optional small line under the course name

   THE AMOUNTS BELOW ARE SAMPLE VALUES - replace them with your real prices.
   ============================================================ */
window.SMARTECH_PRICING = {
  currency: "Rs.",
  courses: [
    { code: "ENG", name: "English Typing Course", note: "Basic to advanced + speed test", buy: "1,500", renew: "1,000", validity: "1 Year" },
    { code: "PBI", name: "Punjabi Typing Course", note: "Basic to advanced + speed test", buy: "1,500", renew: "1,000", validity: "1 Year" },
    { code: "HIN", name: "Hindi Typing Course",   note: "Basic to advanced + speed test", buy: "1,500", renew: "1,000", validity: "1 Year" }
  ],
  // optional extra line, e.g. an offer. Leave "" to hide.
  offer: "",
  how: [
    "Contact the institute and pay the fee for the course you need.",
    "You receive an activation code.",
    "Open Activation (Dashboard bottom links) and enter the code. For a renewal, enter the new code the same way."
  ],
  contact: { text: "Smartech Education Computer Institute", email: "smartecheducation@gmail.com", phone: "" }
};

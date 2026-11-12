# Lessons, speed-test words and study material from GitHub

Besides the exercises file (`smt5.txt`), the app now downloads three more plain-text files from GitHub.
Edit a file on GitHub, commit, and every student gets the change the next time the app is online
(within about 5 minutes, or at once with the **Update** button). No new installer is needed.

| File | What it controls |
|---|---|
| `lessons.txt` | The lessons of the **English, Punjabi and Hindi typing courses** (title, words, number of words per practice) |
| `speedwords.txt` | The random words used by the **Speed Test** (English, Punjabi, Hindi) |
| `materials.txt` | The **Typing Books & Study Material** and **Video Lessons** pages |
| `pricing.txt` | The **Buy / Renew** window on the Dashboard (course buy price, renew price, validity, how to buy, contact) |
| `smt5.txt` (already in use) | Test types, exercises and the **exam cards on the home screen** |

## 1. Upload the files (one time)

The folder `github-content/` in this project holds ready-made copies of `lessons.txt`, `speedwords.txt` and
`materials.txt`. They contain exactly the lessons and words that are built into the app today.

Upload all three **into the same GitHub folder as `smt5.txt`**, i.e. next to it:

```
https://raw.githubusercontent.com/skrajb/smt5/refs/heads/main/smt5.txt          (already there)
https://raw.githubusercontent.com/skrajb/smt5/refs/heads/main/lessons.txt        (new)
https://raw.githubusercontent.com/skrajb/smt5/refs/heads/main/speedwords.txt     (new)
https://raw.githubusercontent.com/skrajb/smt5/refs/heads/main/materials.txt      (new)
https://raw.githubusercontent.com/skrajb/smt5/refs/heads/main/pricing.txt        (new)
```

Until a file exists on GitHub the app simply uses the lessons / words built into it, so nothing breaks.
The `github-content/` folder is not packed into the installer.

If the files live in another folder or repository: open the Dashboard, type `manage` (the hidden Manage panel),
enter the GitHub **folder** URL in the box *Lessons, speed-test words & study material (GitHub)* and press **Save folder** (**Use default** goes back to the exercises-file folder).

## 2. File formats

Anything above the first `###` line is ignored, so you can keep notes there.

### lessons.txt
```
### English | Home Row
count: 120
all ask has dad sad had lad lag add flag gas fall hall
jaals dada jaffa alaska lass alfa kafla dass dash

### Punjabi | ਹੋਮ ਲਾਈਨ
ਪਰ ਕਰ ਤਕ ਤਪ ...
```
- `### <Language> | <Title>` starts a lesson. Language is English, Punjabi or Hindi. Lessons appear in file order and
  are numbered 1, 2, 3 ... by the app (do not put the number in the title).
- `count:` is optional: how many words one practice contains (10 to 500, default 100).
- The words follow, separated by spaces. Line breaks are fine.
- A language that is missing from the file keeps its built-in lessons. If a language is present, the file replaces
  that whole course, so add new lessons at the end to keep the existing numbers.

### speedwords.txt
```
### English
has had lad add dada ask alfa kafla the flag all ...

### Punjabi
...
### Hindi
...
```
- One `### English`, `### Punjabi` or `### Hindi` block each; words separated by spaces, line breaks allowed.
- A word written twice comes up twice as often. At least 5 words per language.

### pricing.txt
```
currency: Rs.
offer: Special offer till 31 March
step: Pay the fee at the institute.
step: You receive an activation code.
contact: Smartech Education Computer Institute
email: smartecheducation@gmail.com
phone: 98xxxxxxxx

### English Typing Course
code: ENG
buy: 1,500
renew: 1,000
validity: 1 Year
note: Basic to advanced + speed test
```
- Lines above the first `###` are settings (`currency`, `offer`, `step` once per step, `contact`, `email`, `phone`). Each `###` block is one course row.
- `code` is optional and not shown. Prices are plain text.
- If the file is missing or unreadable, the prices written in `pricing.js` are shown, so the window is never empty.

### materials.txt
```
### Book | Typing Basics for Exams
url: https://example.com/typing-basics.pdf
desc: Home row to speed building, with practice tables.
language: English
tag: Free

### Video | Home Row in 10 Minutes
url: https://www.youtube.com/watch?v=XXXXXXXXXXX
language: Punjabi
```
- `Book` shows under *Books & Study Material*, `Video` under *Video Lessons*.
- `url:` is required and must start with `http://` or `https://`. `desc`, `language` and `tag` are optional.
- Links open in the student's browser, never inside the app. The page is empty until you add items.
- The page is called **Books & Videos** (`resources.html`). It is **not linked from anywhere right now**: the Dashboard tiles for it were removed and the sidebar no longer exists. To show it again, add `<a href="resources.html">Books & Videos</a>` to the links row at the bottom of `index.html` (or ask for a tile). Until then `materials.txt` has no visible effect.

## 3. Exam cards on the home screen

The three big cards come from the `### TEST` blocks of `smt5.txt`, one card per test, with a button per language
(English / Punjabi / Hindi) that opens that language's exercises. Today that is PHHC, PAU and PSSSB. To add a card
(for example "SSC CGL"), add a `### TEST` block as described in `test_types_format.txt`. Three optional fields
control only the look of the card:

```
### TEST CGL-ENG
name: SSC CGL
subtitle: Typing Test        (label under the name; default "Typing Test")
color: rose                  (blue, amber, green, rose, violet, teal, sky; default = rotates)
icon: badge                  (optional: scales, cap, dome or badge. Otherwise picked from the name: scales for court,
                              cap for university/college/agriculture, badge with the initials for SSC / RRB / Bank, else dome)
```

## 4. What the student sees

- A small status line on each course page, the Speed Test and the Books & Videos page:
  *"Lessons · updated from GitHub just now"* with an **Update** button. If the internet is not reachable the app
  keeps working with the last downloaded copy and says so.
- **Settings** (top right of the home screen) lists every source with its last update and has
  **Update everything now**.
- A lesson that is open is never changed under the student's hands: the new lessons appear when they return to the
  lesson list. A speed test that is running is not restarted; the new words are used from the next test.

## 5. Quick checks if a change does not show up

1. Open the raw URL in a browser (it must show your text, not a 404). The file name must be exactly lowercase
   `lessons.txt`, `speedwords.txt`, `materials.txt`.
2. GitHub's raw links can lag for a minute or two after a commit. Press **Update** after a short wait.
3. Each lesson needs a `### Language | Title` header and at least 3 words; a block with fewer is skipped. If nothing in the
   file can be read, the app keeps the previous copy and the status line shows the problem.

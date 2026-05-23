# Fixtures

Synthetic and lightly modified public-source notices used for development,
manual testing, and the Day 5 eval harness.

| File | Source | Type | Expected outcome |
|---|---|---|---|
| `notices/341-meeting-legit.txt` | synthetic, modeled on Official Form 309A | 341 meeting | `routed` (high confidence) |
| `notices/deficiency-legit.txt` | synthetic, modeled on common district deficiency notice | deficiency | `routed` |
| `notices/discharge-legit.txt` | synthetic, modeled on Official Form B 318 | discharge | `routed` |
| `notices/phishing-fake-nef.txt` | based on U.S. Courts' public fake-NEF warning | phishing | `suspicious` |
| `notices/phishing-uscoorts.txt` | look-alike domain phishing | phishing | `suspicious` |

All names, case numbers, and trustees are fictional. Real PACER samples will be
added in Day 5 from public bankruptcy court training sites and Bankruptcy
Noticing Center example documents.

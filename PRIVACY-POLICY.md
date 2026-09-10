# Smart Pet privacy policy (DRAFT)

Status: draft. Not legal advice. Must be reviewed by a solicitor qualified in
the target market (Ireland / EU GDPR first) before it goes in front of a real
buyer or owner.

Last reviewed by engineering: 2026-09-09.

---

## 1. Who this covers

Smart Pet is operated by the kennel named in the signup ("we", "the kennel").
This policy covers three groups:

- **Buyers and waitlist contacts** whose details the kennel records to manage a
  puppy enquiry, reservation or sale.
- **Owners** who use the Smart Pet owner app for a dog bought from the kennel
  (the owner app is not yet released; this section is forward-looking).
- **Staff** with a login to the kennel console.

Visitors to the public kennel website are covered by section 8 (cookies).

## 2. What we collect

| Group | Data |
|---|---|
| Buyers / waitlist | name, email, phone, town or city, the litter or puppy of interest, deposit status, free-text notes the kennel adds, messages we send you, and a log of when a signed document was downloaded |
| Owners (future) | account email, the dog's profile, and data from any Smart Pet devices on that dog (feeding, water, weight, location, activity) |
| Staff | name, email, role, and an access log of sensitive-data reads (document downloads; camera and door access once those features ship) |
| Animals | breed records, microchip number, health test results, vaccination and worming records, weight history, breeding history. Some of this is personal data where it identifies a breeder or owner. |

We do not collect payment card details. Deposits and balances are handled
outside the system.

## 3. Why we use it (purpose and legal basis)

- **To manage an enquiry, reservation or sale** and to produce the paperwork
  that goes with it (contract, deposit receipt, health guarantee, microchip
  transfer). Legal basis: performance of a contract, or steps before one.
- **To keep in touch about a reserved puppy** (weekly update packs, go-home
  information). Legal basis: contract, or consent you can withdraw at any time.
- **To meet animal-welfare and breeding record-keeping obligations.** Legal
  basis: legal obligation and legitimate interest.
- **To keep the system secure and auditable** (the access log). Legal basis:
  legitimate interest.

We do not sell personal data. We do not use it for advertising.

## 4. Who we share it with

- **Email and SMS providers** (Resend, Twilio) only to deliver a message you
  are due to receive.
- **A microchip registration database** when keepership of a chip transfers to
  you.
- **Our hosting provider** (Vercel for the public website; the kennel's own
  server or cloud for the console and device data).
- **A vet, registry or authority** where we are asked for a record we are
  required to provide.

## 5. How long we keep it

The kennel sets retention windows in the console. Defaults if it sets nothing:
records are kept for as long as the kennel operates, then reviewed.

- **Access log**: the kennel picks a window (for example 90 days). Older
  entries are deleted automatically.
- **Documents** (contracts, certificates): the kennel picks a window. Note that
  a sale contract is often kept for six years to cover a legal claim period;
  the kennel should set this deliberately.
- **Buyer, animal and litter records**: not deleted on a timer. They are
  removed on request (section 6) or when the kennel runs an erasure.

## 6. Your rights

If you are in the EU or UK you can ask us to:

- give you a copy of your data (we can export it as a single file),
- correct anything wrong,
- delete your data ("erasure"), subject to records we must keep by law,
- restrict or object to a particular use,
- withdraw consent for update messages at any time.

To make a request, contact the kennel (section 9). We respond within one month.
You can also complain to the Data Protection Commission (Ireland) or your local
authority.

When we erase a buyer, any puppy that was reserved to them stays in the
kennel's records as kennel stock, with the link to you removed.

## 7. Device data (owner app, future)

Data from Smart Pet devices (feeders, water, collars, cameras, doors) belongs to
the owner of the dog. It is used to run the features the owner turns on. Camera
and audio streams are only accessed on an explicit action, and every access is
written to the access log. Retention for clips will be owner-configurable.

## 8. Cookies and the public website

The public kennel website uses only the cookies it needs to work. It does not
load third-party advertising or analytics trackers by default. If that changes,
this section and a consent banner will be added first.

## 9. Contact

The kennel is the data controller. Contact details are on the kennel's website.
For the platform itself, contact the operator named at signup.

---

## Engineering / legal TODO before launch

- [ ] Solicitor review for Ireland / EU. Confirm controller vs processor split
      between the kennel and the platform operator.
- [ ] Decide the legal-hold window for sale contracts and set it as the shipped
      default.
- [ ] Data Processing Agreement with Resend and Twilio on file.
- [ ] Owner-app section rewritten from forward-looking to actual once Phase 9
      devices ship.
- [ ] Confirm the microchip database's own transfer and privacy terms are
      linked.
- [ ] Add a real retention default rather than "kept while the kennel operates".
- [ ] Translate to Portuguese for the `pt` website locale.

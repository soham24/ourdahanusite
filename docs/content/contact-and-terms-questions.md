# Contact & Terms — what I need from you

Short answers are fine. Anything you skip, I'll either leave out or write in the
safest form and flag it — I won't invent a policy you didn't decide.

---

## A. Contact page (you chose email + phone + WhatsApp)

1. **Which email should be public?**
   The site currently uses two:
   - `hello@ourdahanu.in` — the *sending* address for transactional email
   - `railkarsoham@gmail.com` — the contact address on the Privacy page

   I'd suggest `hello@ourdahanu.in` everywhere (it looks like a business, and it's
   already yours). Say the word and I'll switch the Privacy page to match.

2. **Phone number** to publish?

3. **WhatsApp number** — same as the phone, or different?

4. **Response time** you're comfortable promising — "within 24 hours", "same day",
   or leave it out? Only promise what you'll actually hit.

5. **Separate line for businesses** wanting to list, vs general enquiries? Or one
   inbox for everything?

6. **Social links** — Instagram / Facebook handles to include? You mention social
   pages on the About page but no links exist in the code.

---

## B. Terms — marketplace policies

### What I already know from the code and data

You don't need to answer these; correct me if any are wrong:

- Payments run `owner_razorpay` — **straight into the seller's own Razorpay
  account.** All 3 orders confirm this.
- **You take no commission.** `commission_rate` is 0 on every order.
- Listings cost **₹210/year** (₹500 original), with coupon codes.
- Ratings and reviews are moderator-approved before appearing.

That means **you're not the merchant of record for shop orders — the seller is.**
That's the single most important fact in the Terms, and it's genuinely in your
favour.

### What I need you to decide

**Refunds and delivery**

7. A buyer pays and the seller never delivers. **What do you actually do?** Options
   people usually pick: (a) stay out of it entirely, it's between buyer and seller;
   (b) try to mediate but promise nothing; (c) chase the seller and remove them if
   it repeats.

8. Can a buyer cancel after paying? If so, who refunds them — you or the seller?

9. Do you want to say anything about how long delivery should take, or leave that
   entirely to each seller?

**The ₹210 listing fee**

10. **Refundable?** If a business pays and changes its mind after a week, do they
    get it back?

11. If you remove a listing for breaking the rules, do they get a refund or a
    pro-rata amount? (Most sites say no — that's fine, it just needs stating.)

12. What happens at the end of the year if they don't renew — listing hidden,
    deleted, or kept but marked expired?

**Content and conduct**

13. **Who owns the photos and text a business uploads?** Standard is: they keep
    ownership, and grant you a licence to display it on the site. Happy with that?

14. **What gets a listing removed?** Give me your real list — fake business, abusive
    behaviour, illegal goods, spam reviews, whatever you'd actually act on.

15. Can a business ask you to delete their listing and data entirely? (Your Privacy
    page may already cover this — I'll check and keep them consistent.)

**Legal basics**

16. **Registered business name**, if OurDahanu is registered as an entity. If it's
    you personally, say so — that's normal for a site this size and I'll word it
    accordingly.

17. **Jurisdiction** — I'd write "courts of Palghar, Maharashtra" unless you'd
    rather say Mumbai. Fine to just confirm.

18. **Minimum age** to use the site — 18, or no restriction?

---

## What I'll do with this

- Build `/contact` with your details, a mailto and WhatsApp link, and `ContactPoint`
  schema markup
- Write `/terms` from your answers, in the same plain language as the guides — no
  copy-pasted legal boilerplate
- Add both to the footer, alongside Privacy
- Make the Privacy page's contact email consistent with the Contact page

**One honest caveat:** I'm not a lawyer, and this isn't legal advice. What I write
will accurately describe the policies *you* tell me you follow, in clear language.
For a site handling payments it's worth having someone qualified read it once — but
having accurate, plain Terms is far better than having none, and much better than
generic boilerplate that doesn't match how you actually operate.

import LegalPage from './LegalPage'

const SECTIONS = [
  { heading: 'Information users provide', body: "When you sign up, you give us basics like your name, your email address and how you plan to use UASK." },
  { heading: 'Profile information', body: "Your profile can include a headline, bio, skills, portfolio items and optional contact and social links. Your contact details are meant to be visible only to people you're connected with." },
  { heading: 'ASK/response data', body: "The ASKs you post and the responses you send, including budgets, timelines and descriptions, are visible to the people who need to see them to use the marketplace." },
  { heading: 'Messages', body: "We keep your messages so conversations are still there next time you visit. They are meant only for the people in that conversation." },
  { heading: 'Usage data', body: "The prototype may note simple things like the pages you visit and your preferences, such as your chosen currency. We use this to make UASK work and to make it better." },
  { heading: 'File uploads', body: "Only upload files you have the right to share. Please avoid uploading sensitive personal or financial documents to this prototype." },
  { heading: 'How information is used', body: "We use your information to run the marketplace, suggest ASKs that suit providers, support messaging and contracts, keep the service safe and improve the product." },
  { heading: 'Information sharing', body: "Other users see your information only as needed for the features you use. We don't sell your personal information. If we work with outside service providers in the future, they will only be allowed to use data to help run UASK." },
  { heading: 'Storage/security', body: "In this prototype, data lives in mock services and in your browser's local storage. It is not protected to production security standards, so please don't enter anything sensitive." },
  { heading: 'Account choices', body: "You can update your profile and settings whenever you like, and you can ask us to correct or remove your account and the data tied to it." },
  { heading: 'Future payment-provider data handling', body: "UASK doesn't process real payments today. If we add a payment provider later, that provider will handle your payment details under its own terms, and we'll update this notice before launch." },
  { heading: 'Contact/privacy requests', body: "If you have a privacy question, or want to see, correct or delete your information, send us a message through the Contact form on the About Us page." },
]

export default function Privacy() {
  return (
    <LegalPage
      badge="Prototype Privacy Notice — Not Final Policy"
      title="Privacy Policy"
      intro="This is a plain-language notice about how the UASK prototype handles your information. It is a prototype notice, not our final policy, and the production version will need a legal review before launch."
      sections={SECTIONS}
    />
  )
}

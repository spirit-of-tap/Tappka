/**
 * Onboarding wizard text constants
 * Using serious, professional Czech language
 */

export const ONBOARDING_TEXT = {
  welcome: {
    title: "Vítej v Tappce!",
    subtitle: "Aplikace vytvořená studujícími, pro studující (a kouče:ky).",
    description: "Pro dokončení registrace je potřeba:",
    steps: [
      "Ověřit tvůj ČZU email",
      "Zkontrolovat doručenou poštu nebo spam ve školním Outlooku",
      "Potvrdit kliknutím na tlačítko v emailu (nebo zadat kód)",
    ],
    timeEstimate: "Proces zabere přibližně 1 minutu.",
    button: "Začít",
  },
  
  emailStep: {
    stepIndicator: "Krok 1: Ověření školního emailu",
    title: "Ověř si školní email",
    description: "Zadej svůj školní email, na který ti pošleme ověřovací kód.",
    label: "Tvůj ČZU email",
    placeholder: "xprox040@pef.czu.cz",
    helpText: "Použij svůj ČZU email",
    button: "Poslat ověřovací kód",
    buttonLoading: "Odesílám...",
  },
  
  otpStep: {
    stepIndicator: "Krok 2: Potvrzení emailu",
    title: "Potvrď svůj email",
    sentTo: "Email byl odeslán na:",
    description: "Klikni na tlačítko v emailu. Alternativně můžeš zadat ověřovací kód.",
    label: "Ověřovací kód (volitelně)",
    placeholder: "Zadej 8-místný kód",
    helpText: "Zkontroluj školní Outlook - koukni i do spamu. Klikni na tlačítko v emailu nebo zadej kód níže.",
    button: "Ověřit kód",
    buttonLoading: "Ověřuji...",
    changeEmail: "Změnit email",
  },
  
  pendingStep: {
    stepIndicator: "Krok 3: Čeká na schválení",
    title: "Čekáme na schválení",
    successMessage: "Email byl úspěšně ověřen",
    mainText: "Váš účet nyní čeká na schválení.",
    processTitle: "Co se děje teď:",
    processList: [
      "Admin obdrží oznámení o vaší registraci",
      "Vytvoří váš profil v systému",
      "Po dokončení obdržíte email",
      "Budete mít plný přístup do Tappky",
    ],
    timeEstimate: "Obvyklá doba schválení: do 24 hodin",
    emailLabel: "Váš email:",
    logoutButton: "Odhlásit se",
  },
} as const;

export const ONBOARDING_ERRORS = {
  invalidEmail: "Zadejte platnou emailovou adresu",
  wrongDomain: "Email musí končit na @pef.czu.cz nebo @studenti.czu.cz",
  alreadyUsed: "Tento email je již registrován",
  sendFailed: "Nepodařilo se odeslat kód, zkuste to znovu",
  invalidOtp: "Neplatný ověřovací kód",
  cannotChange: "Email už nejde změnit, protože je propojený s tvým profilem.",
  generic: "Došlo k chybě, zkuste to prosím znovu",
} as const;

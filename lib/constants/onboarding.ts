/**
 * Onboarding wizard text constants
 * Using serious, professional Czech language
 */

export const ONBOARDING_TEXT = {
  welcome: {
    title: "Vítejte v Tappce",
    subtitle: "Váš profil byl vytvořen školou a čeká na aktivaci.",
    description: "K dokončení registrace potřebujeme:",
    steps: [
      "Ověřit váš školní email",
      "Propojit profil s vaším účtem",
    ],
    timeEstimate: "Proces zabere přibližně 1 minutu.",
    button: "Pokračovat",
  },
  
  emailStep: {
    stepIndicator: "Krok 1: Ověření školního emailu",
    title: "Ověř si email",
    description: "Zadejte váš školní email pro ověření účtu",
    label: "Váš školní email",
    placeholder: "jmeno.prijmeni@pef.czu.cz",
    helpText: "Email musí končit na @pef.czu.cz nebo @studenti.czu.cz",
    button: "Odeslat ověřovací kód",
    buttonLoading: "Odesílám...",
  },
  
  otpStep: {
    stepIndicator: "Krok 2: Zadejte ověřovací kód",
    title: "Ověř si email",
    sentTo: "Kód byl odeslán na:",
    description: "Zadejte kód, který byl odeslán na váš email",
    label: "Ověřovací kód",
    placeholder: "Zadejte 8-místný kód",
    helpText: "Zkontrolujte doručenou poštu",
    button: "Ověřit kód",
    buttonLoading: "Ověřuji...",
    changeEmail: "Změnit email",
  },
  
  pendingStep: {
    stepIndicator: "Krok 3: Čeká na schválení",
    title: "Čekáme na schválení",
    successMessage: "Email byl úspěšně ověřen",
    mainText: "Váš účet nyní čeká na schválení administrátorem.",
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

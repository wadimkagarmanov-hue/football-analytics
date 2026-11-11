// Организации помощи при игровой зависимости (выводятся в подвале и на /responsible).
// Перед запуском ДОБАВЬТЕ организации для региона вашей аудитории и проверьте актуальность контактов.

export interface Helpline {
  name: string;
  region: string;
  url: string;
  phone?: string;
}

export const HELPLINES: Helpline[] = [
  { name: 'Gamblers Anonymous (международный сайт, группы взаимопомощи)', region: 'Международно', url: 'https://www.gamblersanonymous.org' },
  { name: 'GamCare', region: 'Великобритания', url: 'https://www.gamcare.org.uk', phone: '0808 8020 133' },
  { name: 'BeGambleAware', region: 'Великобритания', url: 'https://www.begambleaware.org' },
  { name: 'National Problem Gambling Helpline (NCPG)', region: 'США', url: 'https://www.ncpgambling.org', phone: '1-800-522-4700' },
];

import bankProviderCatalog from '../../../public/template-assets/bank/catalog.json';

export interface BankProvider {
  name: string;
  logo: string | null;
}

export const bankProviders: BankProvider[] = bankProviderCatalog;

export const otherProviderName = 'Lainnya';

export function getBankProvider(name: string): BankProvider | undefined {
  const normalized = name.trim().toLocaleLowerCase('id-ID');
  return bankProviders.find((provider) => provider.name.toLocaleLowerCase('id-ID') === normalized);
}

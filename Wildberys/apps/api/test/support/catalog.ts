import type { TestApp } from './test-app.js';

interface NewCategory {
  readonly slug: string;
  readonly cs: string;
  readonly en: string;
  readonly position: number;
  readonly parentId?: string;
  readonly isActive?: boolean;
}

async function createCategory(testApp: TestApp, category: NewCategory): Promise<string> {
  const { id } = await testApp.prisma.category.create({
    data: {
      slug: category.slug,
      position: category.position,
      parentId: category.parentId,
      isActive: category.isActive ?? true,
      translations: {
        create: [
          { locale: 'cs', name: category.cs },
          { locale: 'en', name: category.en },
        ],
      },
    },
  });

  return id;
}

/** The ids of a small category tree. */
export interface TestCategories {
  readonly women: string;
  readonly dresses: string;
  readonly skirts: string;
  readonly cosmetics: string;
  readonly hair: string;
  /** A subcategory of cosmetics that is no longer in use. */
  readonly retired: string;
  /** A section that is no longer in use. */
  readonly archive: string;
}

/**
 * A small catalog: women (dresses, skirts) and cosmetics (hair), plus a subcategory and a section
 * that are switched off. Cosmetics come first in the catalog, although they are made second.
 */
export async function createCategories(testApp: TestApp): Promise<TestCategories> {
  const women = await createCategory(testApp, {
    slug: 'zeny',
    cs: 'Ženy',
    en: 'Women',
    position: 2,
  });
  const cosmetics = await createCategory(testApp, {
    slug: 'kosmetika',
    cs: 'Kosmetika',
    en: 'Cosmetics',
    position: 1,
  });

  return {
    women,
    cosmetics,
    skirts: await createCategory(testApp, {
      slug: 'zeny-sukne',
      cs: 'Sukně',
      en: 'Skirts',
      position: 2,
      parentId: women,
    }),
    dresses: await createCategory(testApp, {
      slug: 'zeny-saty',
      cs: 'Šaty',
      en: 'Dresses',
      position: 1,
      parentId: women,
    }),
    hair: await createCategory(testApp, {
      slug: 'kosmetika-vlasy',
      cs: 'Vlasy',
      en: 'Hair',
      position: 1,
      parentId: cosmetics,
    }),
    retired: await createCategory(testApp, {
      slug: 'kosmetika-stare',
      cs: 'Staré',
      en: 'Old',
      position: 2,
      parentId: cosmetics,
      isActive: false,
    }),
    archive: await createCategory(testApp, {
      slug: 'archiv',
      cs: 'Archiv',
      en: 'Archive',
      position: 3,
      isActive: false,
    }),
  };
}

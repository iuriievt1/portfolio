import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createCategories, type TestCategories } from './support/catalog.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';

describe('Categories', () => {
  let testApp: TestApp;
  let categories: TestCategories;

  const tree = (query: string): request.Test =>
    request(testApp.app.getHttpServer()).get(`/v1/categories${query}`);

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    categories = await createCategories(testApp);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('are open to everyone, in the order of the catalog and in the asked language', async () => {
    const response = await tree('?locale=cs').expect(200);

    expect(response.body).toEqual([
      {
        id: categories.cosmetics,
        slug: 'kosmetika',
        name: 'Kosmetika',
        subcategories: [{ id: categories.hair, slug: 'kosmetika-vlasy', name: 'Vlasy' }],
      },
      {
        id: categories.women,
        slug: 'zeny',
        name: 'Ženy',
        subcategories: [
          { id: categories.dresses, slug: 'zeny-saty', name: 'Šaty' },
          { id: categories.skirts, slug: 'zeny-sukne', name: 'Sukně' },
        ],
      },
    ]);
  });

  it('are named in English too', async () => {
    const response = await tree('?locale=en').expect(200);

    expect(response.body).toMatchObject([
      { name: 'Cosmetics', subcategories: [{ name: 'Hair' }] },
      { name: 'Women', subcategories: [{ name: 'Dresses' }, { name: 'Skirts' }] },
    ]);
  });

  it('leave out what is no longer in use', async () => {
    const response = await tree('?locale=cs').expect(200);
    const shown = JSON.stringify(response.body);

    expect(shown).not.toContain(categories.retired);
    expect(shown).not.toContain(categories.archive);
  });

  it('show the slug of a category that has no name in the language', async () => {
    await testApp.prisma.categoryTranslation.deleteMany({
      where: { categoryId: categories.hair, locale: 'en' },
    });

    const response = await tree('?locale=en').expect(200);

    expect(response.body).toMatchObject([{ subcategories: [{ name: 'kosmetika-vlasy' }] }, {}]);
  });

  it.each([
    ['no language', ''],
    ['a language the store does not speak', '?locale=ru'],
    ['a query the API does not know', '?locale=cs&parent=zeny'],
  ])('are not read with %s', async (_what, query) => {
    const response = await tree(query).expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

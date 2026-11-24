-- DropTable
DROP TABLE "seller_pre_registrations";

-- CreateTable
CREATE TABLE "store_categories" (
    "store_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_categories_pkey" PRIMARY KEY ("store_id","category_id")
);

-- CreateIndex
CREATE INDEX "store_categories_category_id_idx" ON "store_categories"("category_id");

-- AddForeignKey
ALTER TABLE "store_categories" ADD CONSTRAINT "store_categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_categories" ADD CONSTRAINT "store_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The first catalog. Written by hand.
-- Nine sections and their subcategories, as the project owner approved them on 2026-11-17.
-- The sections are the ones the landing page of the store shows. The team changes the tree in the admin later:
-- this only gives every database the same start.
WITH tree (parent_slug, slug, position, name_cs, name_en) AS (
  VALUES
    (NULL::text, 'zeny', 1, 'Ženy', 'Women'),
    (NULL, 'muzi', 2, 'Muži', 'Men'),
    (NULL, 'deti', 3, 'Děti', 'Kids'),
    (NULL, 'obuv', 4, 'Obuv', 'Shoes'),
    (NULL, 'kosmetika', 5, 'Kosmetika', 'Cosmetics'),
    (NULL, 'doplnky', 6, 'Doplňky', 'Accessories'),
    (NULL, 'sport', 7, 'Sport', 'Sport'),
    (NULL, 'domov', 8, 'Domov', 'Home'),
    (NULL, 'elektronika', 9, 'Elektronika', 'Electronics'),

    ('zeny', 'zeny-saty', 1, 'Šaty', 'Dresses'),
    ('zeny', 'zeny-tricka-a-topy', 2, 'Trička a topy', 'T-shirts and tops'),
    ('zeny', 'zeny-mikiny-a-svetry', 3, 'Mikiny a svetry', 'Hoodies and sweaters'),
    ('zeny', 'zeny-kalhoty-a-dziny', 4, 'Kalhoty a džíny', 'Trousers and jeans'),
    ('zeny', 'zeny-sukne', 5, 'Sukně', 'Skirts'),
    ('zeny', 'zeny-bundy-a-kabaty', 6, 'Bundy a kabáty', 'Jackets and coats'),
    ('zeny', 'zeny-spodni-pradlo', 7, 'Spodní prádlo', 'Underwear'),

    ('muzi', 'muzi-tricka-a-kosile', 1, 'Trička a košile', 'T-shirts and shirts'),
    ('muzi', 'muzi-mikiny-a-svetry', 2, 'Mikiny a svetry', 'Hoodies and sweaters'),
    ('muzi', 'muzi-kalhoty-a-dziny', 3, 'Kalhoty a džíny', 'Trousers and jeans'),
    ('muzi', 'muzi-bundy-a-kabaty', 4, 'Bundy a kabáty', 'Jackets and coats'),
    ('muzi', 'muzi-spodni-pradlo', 5, 'Spodní prádlo', 'Underwear'),

    ('deti', 'deti-detske-obleceni', 1, 'Dětské oblečení', 'Kids'' clothing'),
    ('deti', 'deti-kojenecke-obleceni', 2, 'Kojenecké oblečení', 'Baby clothing'),
    ('deti', 'deti-hracky', 3, 'Hračky', 'Toys'),

    ('obuv', 'obuv-damska', 1, 'Dámská obuv', 'Women''s shoes'),
    ('obuv', 'obuv-panska', 2, 'Pánská obuv', 'Men''s shoes'),
    ('obuv', 'obuv-detska', 3, 'Dětská obuv', 'Kids'' shoes'),

    ('kosmetika', 'kosmetika-pece-o-plet', 1, 'Péče o pleť', 'Skin care'),
    ('kosmetika', 'kosmetika-make-up', 2, 'Make-up', 'Make-up'),
    ('kosmetika', 'kosmetika-vlasy', 3, 'Vlasy', 'Hair'),
    ('kosmetika', 'kosmetika-parfemy', 4, 'Parfémy', 'Perfumes'),
    ('kosmetika', 'kosmetika-pece-o-telo', 5, 'Péče o tělo', 'Body care'),

    ('doplnky', 'doplnky-kabelky-a-tasky', 1, 'Kabelky a tašky', 'Handbags and bags'),
    ('doplnky', 'doplnky-sperky-a-hodinky', 2, 'Šperky a hodinky', 'Jewellery and watches'),
    ('doplnky', 'doplnky-cepice-saly-a-rukavice', 3, 'Čepice, šály a rukavice', 'Hats, scarves and gloves'),
    ('doplnky', 'doplnky-opasky-a-penezenky', 4, 'Opasky a peněženky', 'Belts and wallets'),
    ('doplnky', 'doplnky-slunecni-bryle', 5, 'Sluneční brýle', 'Sunglasses'),

    ('sport', 'sport-obleceni', 1, 'Sportovní oblečení', 'Sportswear'),
    ('sport', 'sport-obuv', 2, 'Sportovní obuv', 'Sports shoes'),
    ('sport', 'sport-vybaveni', 3, 'Sportovní vybavení', 'Sports equipment'),

    ('domov', 'domov-bytovy-textil', 1, 'Bytový textil', 'Home textiles'),
    ('domov', 'domov-dekorace', 2, 'Dekorace', 'Decorations'),
    ('domov', 'domov-kuchyne', 3, 'Kuchyně', 'Kitchen'),

    ('elektronika', 'elektronika-telefony-a-prislusenstvi', 1, 'Telefony a příslušenství', 'Phones and accessories'),
    ('elektronika', 'elektronika-audio', 2, 'Audio', 'Audio'),
    ('elektronika', 'elektronika-chytre-hodinky', 3, 'Chytré hodinky', 'Smart watches')
),
sections AS (
  INSERT INTO "categories" ("id", "parent_id", "slug", "position", "updated_at")
  SELECT uuidv7(), NULL, tree.slug, tree.position, CURRENT_TIMESTAMP
  FROM tree
  WHERE tree.parent_slug IS NULL
  RETURNING "id", "slug"
),
subcategories AS (
  INSERT INTO "categories" ("id", "parent_id", "slug", "position", "updated_at")
  SELECT uuidv7(), sections.id, tree.slug, tree.position, CURRENT_TIMESTAMP
  FROM tree
  JOIN sections ON sections.slug = tree.parent_slug
  RETURNING "id", "slug"
),
created AS (
  SELECT "id", "slug" FROM sections
  UNION ALL
  SELECT "id", "slug" FROM subcategories
)
INSERT INTO "category_translations" ("category_id", "locale", "name")
SELECT created.id, names.locale::"locale", names.name
FROM created
JOIN tree ON tree.slug = created.slug
CROSS JOIN LATERAL (VALUES ('cs', tree.name_cs), ('en', tree.name_en)) AS names (locale, name);

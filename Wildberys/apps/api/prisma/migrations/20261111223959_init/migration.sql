-- CreateEnum
CREATE TYPE "currency" AS ENUM ('CZK', 'EUR');

-- CreateEnum
CREATE TYPE "locale" AS ENUM ('cs', 'en', 'ru');

-- CreateEnum
CREATE TYPE "attribute_type" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "platform_role" AS ENUM ('OWNER', 'SUPPORT', 'MODERATOR', 'FINANCE', 'LOGISTICS');

-- CreateEnum
CREATE TYPE "ledger_account_type" AS ENUM ('PAYMENTS', 'COMMISSION', 'DELIVERY', 'SELLER_PENDING', 'SELLER_AVAILABLE', 'SELLER_RESERVE', 'PAYOUTS');

-- CreateEnum
CREATE TYPE "ledger_transaction_type" AS ENUM ('PAYMENT', 'REFUND', 'RELEASE', 'PAYOUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ledger_entry_direction" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "offer_status" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "stock_location_type" AS ENUM ('SELLER', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('PENDING', 'CONFIRMED', 'PACKED', 'HANDED_OVER', 'IN_TRANSIT', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "carrier" AS ENUM ('ZASILKOVNA', 'WOLT_DRIVE', 'LIFTAGO');

-- CreateEnum
CREATE TYPE "delivery_method" AS ENUM ('EXPRESS', 'SAME_DAY', 'HOME', 'PICKUP_POINT', 'PARCEL_BOX');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CARD', 'APPLE_PAY', 'GOOGLE_PAY');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "return_reason" AS ENUM ('SIZE', 'NOT_AS_DESCRIBED', 'DAMAGED', 'WRONG_ITEM', 'CHANGED_MIND', 'OTHER');

-- CreateEnum
CREATE TYPE "return_status" AS ENUM ('REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'REFUNDED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "return_shipping_payer" AS ENUM ('BUYER', 'SELLER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "warranty_claim_status" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "warranty_claim_resolution" AS ENUM ('REPAIR', 'REPLACEMENT', 'REFUND', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "seller_legal_form" AS ENUM ('COMPANY', 'SOLE_TRADER');

-- CreateEnum
CREATE TYPE "seller_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "seller_member_role" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "store_status" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateTable
CREATE TABLE "markets" (
    "id" UUID NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "currency" "currency" NOT NULL,
    "default_locale" "locale" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "recipient_name" TEXT,
    "phone" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translations" (
    "category_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("category_id","locale")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "attribute_type" NOT NULL,
    "unit" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_translations" (
    "attribute_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "attribute_translations_pkey" PRIMARY KEY ("attribute_id","locale")
);

-- CreateTable
CREATE TABLE "attribute_options" (
    "id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attribute_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_option_translations" (
    "option_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "attribute_option_translations_pkey" PRIMARY KEY ("option_id","locale")
);

-- CreateTable
CREATE TABLE "category_attributes" (
    "category_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_variant_axis" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("category_id","attribute_id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "brand_id" UUID,
    "slug" TEXT NOT NULL,
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "created_by_store_id" UUID,
    "manufacturer_name" TEXT,
    "manufacturer_address" TEXT,
    "manufacturer_contact" TEXT,
    "responsible_person_name" TEXT,
    "responsible_person_address" TEXT,
    "responsible_person_contact" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_translations" (
    "product_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("product_id","locale")
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "option_id" UUID,
    "text_value" TEXT,
    "number_value" DECIMAL(18,4),
    "boolean_value" BOOLEAN,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "gtin" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_options" (
    "variant_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,

    CONSTRAINT "variant_options_pkey" PRIMARY KEY ("variant_id","attribute_id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "file_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "locale" "locale" NOT NULL DEFAULT 'cs',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMPTZ(3),
    "phone_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_platform_roles" (
    "user_id" UUID NOT NULL,
    "role" "platform_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_platform_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "type" "ledger_account_type" NOT NULL,
    "seller_id" UUID,
    "currency" "currency" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL,
    "type" "ledger_transaction_type" NOT NULL,
    "description" TEXT,
    "order_id" UUID,
    "shipment_id" UUID,
    "payment_id" UUID,
    "refund_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "ledger_entry_direction" NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" "currency" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "market_id" UUID NOT NULL,
    "seller_sku" TEXT,
    "price_amount" BIGINT NOT NULL,
    "currency" "currency" NOT NULL,
    "status" "offer_status" NOT NULL DEFAULT 'PAUSED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" UUID NOT NULL,
    "type" "stock_location_type" NOT NULL,
    "seller_id" UUID,
    "name" TEXT NOT NULL,
    "address_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "buyer_id" UUID NOT NULL,
    "market_id" UUID NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" "currency" NOT NULL,
    "items_amount" BIGINT NOT NULL,
    "delivery_amount" BIGINT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "locale" "locale" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL DEFAULT 'PENDING',
    "carrier" "carrier" NOT NULL,
    "delivery_method" "delivery_method" NOT NULL,
    "delivery_amount" BIGINT NOT NULL,
    "currency" "currency" NOT NULL,
    "delivery_address_id" UUID,
    "pickup_point_code" TEXT,
    "pickup_point_name" TEXT,
    "tracking_number" TEXT,
    "carrier_reference" TEXT,
    "promised_delivery_at" TIMESTAMPTZ(3),
    "confirmed_at" TIMESTAMPTZ(3),
    "handed_over_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_amount" BIGINT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "currency" "currency" NOT NULL,
    "product_name" TEXT NOT NULL,
    "variant_name" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "provider_payment_id" TEXT,
    "method" "payment_method",
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "amount" BIGINT NOT NULL,
    "currency" "currency" NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "provider_refund_id" TEXT,
    "status" "refund_status" NOT NULL DEFAULT 'PENDING',
    "amount" BIGINT NOT NULL,
    "currency" "currency" NOT NULL,
    "return_request_id" UUID,
    "warranty_claim_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "shipment_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "status" "return_status" NOT NULL DEFAULT 'REQUESTED',
    "reason" "return_reason" NOT NULL,
    "comment" TEXT,
    "shipping_paid_by" "return_shipping_payer" NOT NULL,
    "received_at" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "return_request_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("return_request_id","order_item_id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "order_item_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "status" "warranty_claim_status" NOT NULL DEFAULT 'SUBMITTED',
    "description" TEXT NOT NULL,
    "requested_resolution" "warranty_claim_resolution",
    "resolution" "warranty_claim_resolution",
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "legal_form" "seller_legal_form" NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "registration_number" TEXT NOT NULL,
    "vat_number" TEXT,
    "is_vat_payer" BOOLEAN NOT NULL DEFAULT false,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "registered_address_id" UUID NOT NULL,
    "status" "seller_status" NOT NULL DEFAULT 'DRAFT',
    "stripe_account_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_members" (
    "seller_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "seller_member_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_members_pkey" PRIMARY KEY ("seller_id","user_id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo_file_key" TEXT,
    "status" "store_status" NOT NULL DEFAULT 'DRAFT',
    "express_enabled" BOOLEAN NOT NULL DEFAULT false,
    "return_address_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "markets_country_code_key" ON "markets"("country_code");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_code_key" ON "attributes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_options_attribute_id_code_key" ON "attribute_options"("attribute_id", "code");

-- CreateIndex
CREATE INDEX "category_attributes_attribute_id_idx" ON "category_attributes"("attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_status_idx" ON "products"("category_id", "status");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_created_by_store_id_idx" ON "products"("created_by_store_id");

-- CreateIndex
CREATE INDEX "product_attribute_values_attribute_id_idx" ON "product_attribute_values"("attribute_id");

-- CreateIndex
CREATE INDEX "product_attribute_values_option_id_idx" ON "product_attribute_values"("option_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_values_product_id_attribute_id_option_id_key" ON "product_attribute_values"("product_id", "attribute_id", "option_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_gtin_key" ON "product_variants"("gtin");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "variant_options_attribute_id_idx" ON "variant_options"("attribute_id");

-- CreateIndex
CREATE INDEX "variant_options_option_id_idx" ON "variant_options"("option_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_position_idx" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_images_variant_id_idx" ON "product_images"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "ledger_accounts_seller_id_idx" ON "ledger_accounts"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_type_seller_id_currency_key" ON "ledger_accounts"("type", "seller_id", "currency");

-- CreateIndex
CREATE INDEX "ledger_transactions_order_id_idx" ON "ledger_transactions"("order_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_shipment_id_idx" ON "ledger_transactions"("shipment_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_payment_id_idx" ON "ledger_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_refund_id_idx" ON "ledger_transactions"("refund_id");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "offers_variant_id_market_id_status_idx" ON "offers"("variant_id", "market_id", "status");

-- CreateIndex
CREATE INDEX "offers_market_id_idx" ON "offers"("market_id");

-- CreateIndex
CREATE UNIQUE INDEX "offers_store_id_variant_id_market_id_key" ON "offers"("store_id", "variant_id", "market_id");

-- CreateIndex
CREATE INDEX "stock_locations_seller_id_idx" ON "stock_locations"("seller_id");

-- CreateIndex
CREATE INDEX "stock_locations_address_id_idx" ON "stock_locations"("address_id");

-- CreateIndex
CREATE INDEX "stock_items_store_id_variant_id_idx" ON "stock_items"("store_id", "variant_id");

-- CreateIndex
CREATE INDEX "stock_items_variant_id_idx" ON "stock_items"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_stock_location_id_store_id_variant_id_key" ON "stock_items"("stock_location_id", "store_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_buyer_id_created_at_idx" ON "orders"("buyer_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_market_id_idx" ON "orders"("market_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_store_id_status_idx" ON "shipments"("store_id", "status");

-- CreateIndex
CREATE INDEX "shipments_stock_location_id_idx" ON "shipments"("stock_location_id");

-- CreateIndex
CREATE INDEX "shipments_delivery_address_id_idx" ON "shipments"("delivery_address_id");

-- CreateIndex
CREATE INDEX "order_items_shipment_id_idx" ON "order_items"("shipment_id");

-- CreateIndex
CREATE INDEX "order_items_offer_id_idx" ON "order_items"("offer_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_provider_refund_id_key" ON "refunds"("provider_refund_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_return_request_id_idx" ON "refunds"("return_request_id");

-- CreateIndex
CREATE INDEX "refunds_warranty_claim_id_idx" ON "refunds"("warranty_claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_number_key" ON "return_requests"("number");

-- CreateIndex
CREATE INDEX "return_requests_shipment_id_idx" ON "return_requests"("shipment_id");

-- CreateIndex
CREATE INDEX "return_requests_buyer_id_idx" ON "return_requests"("buyer_id");

-- CreateIndex
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");

-- CreateIndex
CREATE INDEX "return_items_order_item_id_idx" ON "return_items"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_number_key" ON "warranty_claims"("number");

-- CreateIndex
CREATE INDEX "warranty_claims_order_item_id_idx" ON "warranty_claims"("order_item_id");

-- CreateIndex
CREATE INDEX "warranty_claims_buyer_id_idx" ON "warranty_claims"("buyer_id");

-- CreateIndex
CREATE INDEX "warranty_claims_status_due_at_idx" ON "warranty_claims"("status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_stripe_account_id_key" ON "sellers"("stripe_account_id");

-- CreateIndex
CREATE INDEX "sellers_status_idx" ON "sellers"("status");

-- CreateIndex
CREATE INDEX "sellers_registered_address_id_idx" ON "sellers"("registered_address_id");

-- CreateIndex
CREATE INDEX "sellers_reviewed_by_id_idx" ON "sellers"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_country_code_registration_number_key" ON "sellers"("country_code", "registration_number");

-- CreateIndex
CREATE INDEX "seller_members_user_id_idx" ON "seller_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "stores_seller_id_idx" ON "stores"("seller_id");

-- CreateIndex
CREATE INDEX "stores_return_address_id_idx" ON "stores"("return_address_id");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_translations" ADD CONSTRAINT "attribute_translations_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_option_translations" ADD CONSTRAINT "attribute_option_translations_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "attribute_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_store_id_fkey" FOREIGN KEY ("created_by_store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_platform_roles" ADD CONSTRAINT "user_platform_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_warranty_claim_id_fkey" FOREIGN KEY ("warranty_claim_id") REFERENCES "warranty_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_registered_address_id_fkey" FOREIGN KEY ("registered_address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_return_address_id_fkey" FOREIGN KEY ("return_address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity rules that the Prisma schema cannot express. Written by hand.
-- Keep them when the tables change: Prisma does not see check constraints.
-- ---------------------------------------------------------------------------

-- Emails are stored in lowercase, so the unique index catches every duplicate.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));

-- A stock location has a seller exactly when it is the seller's own place.
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_seller_matches_type" CHECK (("type" = 'SELLER') = ("seller_id" IS NOT NULL));

-- Stock is never negative and never reserved beyond what exists.
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_quantity_valid" CHECK ("quantity" >= 0 AND "reserved_quantity" >= 0 AND "reserved_quantity" <= "quantity");

-- A product attribute value holds exactly one kind of value.
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_one_value" CHECK (num_nonnulls("option_id", "text_value", "number_value", "boolean_value") = 1);

-- Money amounts.
ALTER TABLE "offers" ADD CONSTRAINT "offers_price_not_negative" CHECK ("price_amount" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_valid" CHECK ("items_amount" >= 0 AND "delivery_amount" >= 0 AND "total_amount" = "items_amount" + "delivery_amount");
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_delivery_amount_not_negative" CHECK ("delivery_amount" >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_amounts_valid" CHECK ("quantity" > 0 AND "unit_price_amount" >= 0 AND "total_amount" = "unit_price_amount" * "quantity");
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_quantity_positive" CHECK ("quantity" > 0);

-- A shipment goes either to a pickup point or to an address, depending on the delivery method.
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_destination_matches_method" CHECK (
  ("delivery_method" IN ('PICKUP_POINT', 'PARCEL_BOX')) = ("pickup_point_code" IS NOT NULL)
  AND ("delivery_method" IN ('PICKUP_POINT', 'PARCEL_BOX')) = ("delivery_address_id" IS NULL)
);

-- A refund belongs to a return, to a warranty claim, or to neither (a cancelled order), never to both.
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_one_reason" CHECK (num_nonnulls("return_request_id", "warranty_claim_id") <= 1);

-- Seller accounts have a seller, platform accounts do not.
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_seller_matches_type" CHECK (("type" IN ('SELLER_PENDING', 'SELLER_AVAILABLE', 'SELLER_RESERVE')) = ("seller_id" IS NOT NULL));

-- Unique indexes for rows where a nullable column is empty (a normal unique index ignores them).
-- There is one platform account per type and currency.
CREATE UNIQUE INDEX "ledger_accounts_platform_type_currency_key" ON "ledger_accounts" ("type", "currency") WHERE "seller_id" IS NULL;
-- A product has one text, number or boolean value per attribute.
CREATE UNIQUE INDEX "product_attribute_values_single_value_key" ON "product_attribute_values" ("product_id", "attribute_id") WHERE "option_id" IS NULL;

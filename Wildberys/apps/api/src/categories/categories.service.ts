import { HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { AppException } from '../errors/app.exception.js';
import type { Locale } from '../generated/prisma/enums.js';
import type { CategorySection } from './categories.dto.js';

interface NamedCategory {
  readonly slug: string;
  readonly translations: readonly { readonly name: string }[];
}

/** The name in the asked language. A category without one shows its slug, so it is never empty. */
function nameOf({ slug, translations }: NamedCategory): string {
  return translations[0]?.name ?? slug;
}

/** The category tree of the catalog: sections and their subcategories. */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The categories that are in use, in the order of the catalog, with names in one language. */
  async tree(locale: Locale): Promise<CategorySection[]> {
    const translations = { where: { locale } };
    const sections = await this.prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [{ position: 'asc' }, { slug: 'asc' }],
      include: {
        translations,
        children: {
          where: { isActive: true },
          orderBy: [{ position: 'asc' }, { slug: 'asc' }],
          include: { translations },
        },
      },
    });

    return sections.map((section) => ({
      id: section.id,
      slug: section.slug,
      name: nameOf(section),
      subcategories: section.children.map((child) => ({
        id: child.id,
        slug: child.slug,
        name: nameOf(child),
      })),
    }));
  }

  /**
   * What a store sells, written the short way. A section stands for all of its subcategories:
   * a subcategory of a chosen section is dropped, and a section whose subcategories are all chosen
   * is kept as the section. Every id has to be a category that is in use.
   */
  async normalize(categoryIds: readonly string[]): Promise<string[]> {
    const chosen = await this.prisma.category.findMany({
      where: { id: { in: [...categoryIds] }, isActive: true },
      select: { id: true, parentId: true },
    });

    if (chosen.length !== new Set(categoryIds).size) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'CATEGORY_NOT_FOUND',
        'One of the categories does not exist or is not in use',
      );
    }

    const chosenIds = new Set(chosen.map(({ id }) => id));
    const parentIds = chosen.flatMap(({ parentId }) => (parentId ? [parentId] : []));
    const parents = await this.prisma.category.findMany({
      where: { id: { in: parentIds } },
      select: { id: true, children: { where: { isActive: true }, select: { id: true } } },
    });
    const wholeSections = new Set(
      parents
        .filter(({ children }) => children.every((child) => chosenIds.has(child.id)))
        .map(({ id }) => id),
    );
    const covered = (parentId: string | null): boolean =>
      parentId !== null && (chosenIds.has(parentId) || wholeSections.has(parentId));

    return [
      ...new Set([
        ...chosen.filter(({ parentId }) => !covered(parentId)).map(({ id }) => id),
        ...wholeSections,
      ]),
    ];
  }
}

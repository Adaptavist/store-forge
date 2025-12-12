/**
 * The maximum page size supported by Forge KV
 */
export const MAXIMUM_PAGE_SIZE = 100;

/**
 * Global configuration for store-forge-kv
 */
export const config = {
  /**
   * The default page size for listItems
   */
  defaultListItemsPageSize: MAXIMUM_PAGE_SIZE,

  /**
   * The default page size for clearItems
   */
  defaultClearItemsPageSize: MAXIMUM_PAGE_SIZE,
};

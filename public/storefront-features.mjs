/** Pure catalog helpers; no Firebase writes or network calls. */
export function categoryFamily(categoryId, categories = []) {
    const category = categories.find(item => item.id === categoryId);
    return category?.parentCategory || categoryId;
}

export function canCompare(first, second, categories = []) {
    if (!first || !second || first.isHidden || second.isHidden || first.id === second.id) return false;
    const firstCategory = first.categoryId || first.category;
    const secondCategory = second.categoryId || second.category;
    return !!firstCategory && !!secondCategory && firstCategory === secondCategory;
}

export function findBudgetRecommendations(catalog, categories, { goal = '', budget = 0, use = '' } = {}) {
    const maxBudget = Number(budget);
    if (!Number.isFinite(maxBudget) || maxBudget <= 0) return [];
    const filtered = catalog.filter(product => {
        if (product.isHidden || product.inStock === false || product.stockQuantity === 0) return false;
        if (!(Number(product.price) > 0 && Number(product.price) <= maxBudget)) return false;
        const categoryId = product.categoryId || product.category || '';
        const family = categoryFamily(categoryId, categories);
        if (goal === 'laptop') return /laptop|لابتوب/i.test(categoryId + ' ' + family);
        if (goal === 'upgrade') return /cpu|gpu|ram|storage|motherboard|psu|cooling|case|parts/i.test(categoryId + ' ' + family);
        if (goal === 'part') return !/laptop|bundle/i.test(categoryId + ' ' + family);
        if (goal === 'build') return /bundle|desktop|computer|pc/i.test(categoryId + ' ' + family);
        return true;
    });
    const keywords = use === 'gaming' ? /gaming|game|rtx|radeon|ألعاب|العاب/i : use === 'design' ? /workstation|creator|تصميم|مونتاج|render|رندر/i : /./;
    return filtered.sort((a, b) => Number(keywords.test(b.name + ' ' + (b.description || ''))) - Number(keywords.test(a.name + ' ' + (a.description || ''))) || Number(b.price) - Number(a.price)).slice(0, 3);
}

export function publicSpecs(product) {
    const raw = product.specifications || product.specs || {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([key, value]) => key && value !== null && value !== undefined && String(value).trim()).slice(0, 18));
}

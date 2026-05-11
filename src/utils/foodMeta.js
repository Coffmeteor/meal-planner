import { foods } from './foods.js'

const CATEGORY_BY_ID = {
  'chicken-breast': 'protein',
  egg: 'protein',
  shrimp: 'protein',
  'beef-lean': 'protein',
  'tofu-firm': 'protein',
  salmon: 'protein',
  cod: 'protein',
  turkey: 'protein',
  'chicken-leg-skinless': 'protein',
  'greek-yogurt': 'protein',
  'protein-milk': 'protein',
  edamame: 'protein',
  oats: 'carb',
  'brown-rice': 'carb',
  'buckwheat-noodle': 'carb',
  'whole-wheat-bread': 'carb',
  'purple-sweet-potato': 'carb',
  corn: 'carb',
  'millet-porridge': 'carb',
  'sweet-potato': 'carb',
  quinoa: 'carb',
  'black-rice': 'carb',
  pumpkin: 'carb',
  broccoli: 'vegetable',
  spinach: 'vegetable',
  tomato: 'vegetable',
  'bok-choy': 'vegetable',
  mushroom: 'vegetable',
  cucumber: 'vegetable',
  konjac: 'vegetable',
  almond: 'fat',
  apple: 'fruit',
  banana: 'fruit',
  blueberry: 'fruit',
  'milk-lowfat': 'dairy',
  'soy-milk': 'dairy',
}

export const FOOD_CATEGORY_LABELS = {
  all: '全部',
  protein: '蛋白质',
  carb: '主食',
  vegetable: '蔬菜',
  fat: '脂肪',
  fruit: '水果',
  dairy: '乳制品',
}

export const FOOD_CATEGORY_OPTIONS = Object.entries(FOOD_CATEGORY_LABELS)
  .filter(([value]) => value !== 'all')
  .map(([value, label]) => ({ value, label }))

export const DEFAULT_FOODS = foods.map((food) => ({
  id: food.id,
  name: food.name,
  category: CATEGORY_BY_ID[food.id] || 'carb',
  source: 'default',
  per100g: {
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  },
  mealFit: [food.category],
  tags: [...food.tags],
  defaultPortion: food.defaultPortion,
  unit: food.unit,
}))

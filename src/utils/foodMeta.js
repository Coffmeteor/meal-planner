import { foods } from './foods.js'

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
  ...food,
  source: 'default',
}))

import { IngredientType, RECIPES, RecipeId } from '../core/GameConfig';

export interface AssemblyValidationResult {
  canAdd: boolean;
  reason?: string;
  completedRecipe?: RecipeId;
}

export class BurgerAssembly {
  layers: IngredientType[] = [];
  hasSoda = false;

  canAddIngredient(ingredient: IngredientType): AssemblyValidationResult {
    if (ingredient === 'patty_raw') {
      return { canAdd: false, reason: 'Çiğ köfte eklenemez! Önce ızgarada pişirin.' };
    }
    if (ingredient === 'patty_burnt') {
      return { canAdd: false, reason: 'Yanmış köfte kullanılamaz! Çöp kutusuna atın.' };
    }

    const step = this.layers.length;

    if (step === 0) {
      if (ingredient !== 'bun_bottom') {
        return { canAdd: false, reason: 'Burger hazırlamaya Alt Ekmek ile başlamalısınız!' };
      }
      return { canAdd: true };
    }

    // If top bun is already placed, burger is already closed
    if (this.layers[this.layers.length - 1] === 'bun_top') {
      return { canAdd: false, reason: 'Burger zaten tamamlandı! Tezgâhtan teslim alabilirsiniz.' };
    }

    if (step === 1) {
      if (ingredient !== 'patty_cooked') {
        return { canAdd: false, reason: 'Alt ekmeğin üzerine Pişmiş Köfte koymalısınız!' };
      }
      return { canAdd: true };
    }

    if (step === 2) {
      if (ingredient === 'cheese' || ingredient === 'lettuce') {
        return { canAdd: true };
      }
      return {
        canAdd: false,
        reason: 'Köftenin üzerine Peynir (Cheeseburger / Double Smash) veya Marul (Klasik) ekleyin!',
      };
    }

    if (step === 3) {
      const prev = this.layers[2];
      if (prev === 'lettuce') {
        if (ingredient === 'bun_top') {
          return { canAdd: true, completedRecipe: 'classic_burger' };
        }
        return { canAdd: false, reason: 'Klasik Burgeri tamamlamak için Üst Ekmek koyun!' };
      }
      if (prev === 'cheese') {
        // Branch: Lettuce for Cheeseburger, or 2nd Patty for Double Smash Burger!
        if (ingredient === 'lettuce' || ingredient === 'patty_cooked') {
          return { canAdd: true };
        }
        return {
          canAdd: false,
          reason: 'Peynirin üzerine Taze Marul (Cheeseburger) veya 2. Pişmiş Köfte (Double Smash) ekleyin!',
        };
      }
    }

    if (step === 4) {
      const thirdLayer = this.layers[3];
      if (thirdLayer === 'lettuce') {
        if (ingredient === 'bun_top') {
          return { canAdd: true, completedRecipe: 'cheeseburger' };
        }
        return { canAdd: false, reason: 'Cheeseburgeri tamamlamak için Üst Ekmek koyun!' };
      }
      if (thirdLayer === 'patty_cooked') {
        if (ingredient === 'cheese') {
          return { canAdd: true };
        }
        return {
          canAdd: false,
          reason: 'Double Smash için 2. köftenin üzerine 2. Cheddar Peyniri ekleyin!',
        };
      }
    }

    if (step === 5) {
      if (ingredient === 'lettuce') {
        return { canAdd: true };
      }
      return {
        canAdd: false,
        reason: 'Double Smash için 2. peynirin üzerine Taze Marul ekleyin!',
      };
    }

    if (step === 6) {
      if (ingredient === 'bun_top') {
        return { canAdd: true, completedRecipe: 'double_smash' };
      }
      return {
        canAdd: false,
        reason: 'Double Smash Burgeri tamamlamak için Üst Ekmek koyun!',
      };
    }

    return { canAdd: false, reason: 'Bu malzeme şu anda eklenemez.' };
  }

  addIngredient(ingredient: IngredientType): AssemblyValidationResult {
    const check = this.canAddIngredient(ingredient);
    if (!check.canAdd) return check;
    this.layers.push(ingredient);
    return check;
  }

  addSoda(): { success: boolean; reason?: string } {
    if (this.hasSoda) {
      return { success: false, reason: 'Tepside zaten gazlı içecek var!' };
    }
    this.hasSoda = true;
    return { success: true };
  }

  getCompletedBurgerRecipe(): RecipeId | null {
    for (const [id, recipe] of Object.entries(RECIPES) as [
      RecipeId,
      (typeof RECIPES)[RecipeId],
    ][]) {
      if (
        this.layers.length === recipe.layers.length &&
        this.layers.every((l, idx) => l === recipe.layers[idx])
      ) {
        return id;
      }
    }
    return null;
  }

  isEmpty(): boolean {
    return this.layers.length === 0 && !this.hasSoda;
  }

  clear(): void {
    this.layers = [];
    this.hasSoda = false;
  }

  getNextHint(): string {
    const step = this.layers.length;
    if (step === 0) return '1. Alt Ekmek yerleştirin';
    if (this.layers[step - 1] === 'bun_top') {
      const r = this.getCompletedBurgerRecipe();
      if (r === 'double_smash') return 'Double Smash Burger Hazır!';
      if (r === 'cheeseburger') return 'Cheeseburger Hazır!';
      return 'Klasik Burger Hazır!';
    }
    if (step === 1) return '2. Pişmiş Köfte yerleştirin';
    if (step === 2) return '3. Marul (Klasik) veya Cheddar (Cheese / Double Smash) ekleyin';
    if (step === 3) {
      return this.layers[2] === 'cheese'
        ? '4. Marul (Cheeseburger) veya 2. Köfte (Double Smash) ekleyin'
        : '4. Üst Ekmek ile kapatın';
    }
    if (step === 4) {
      return this.layers[3] === 'patty_cooked'
        ? '5. İkinci Cheddar Peyniri ekleyin (Double Smash)'
        : '5. Üst Ekmek ile kapatın (Cheeseburger)';
    }
    if (step === 5) return '6. Taze Marul ekleyin (Double Smash)';
    if (step === 6) return '7. Üst Ekmek ile kapatın (Double Smash)';
    return '';
  }
}

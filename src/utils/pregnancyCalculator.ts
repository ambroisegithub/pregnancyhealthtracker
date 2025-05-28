import { PregnancyCalculations } from "../types";

export class PregnancyCalculator {
  static calculateEDD(lmpDate: Date): Date {
    const edd = new Date(lmpDate);
    
    // Add 7 days
    edd.setDate(edd.getDate() + 7);
    
    // Add 9 months (280 days total from LMP)
    edd.setMonth(edd.getMonth() + 9);
    
    // Handle month overflow
    if (edd.getMonth() > 11) {
      edd.setFullYear(edd.getFullYear() + 1);
      edd.setMonth(edd.getMonth() - 12);
    }
    
    return edd;
  }

  static calculateGestationalAge(lmpDate: Date): { weeks: number; days: number; totalDays: number } {
    const today = new Date();
    const timeDiff = today.getTime() - lmpDate.getTime();
    const totalDays = Math.floor(timeDiff / (1000 * 3600 * 24));
    
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    
    return {
      weeks,
      days,
      totalDays
    };
  }

  static determineTrimester(gestationalWeeks: number): number {
    if (gestationalWeeks <= 12) return 1;
    if (gestationalWeeks <= 28) return 2;
    return 3;
  }

  static calculatePregnancyDetails(lmpDate: Date): PregnancyCalculations {
    const expectedDeliveryDate = this.calculateEDD(lmpDate);
    const gestationalAge = this.calculateGestationalAge(lmpDate);
    const trimester = this.determineTrimester(gestationalAge.weeks);

    return {
      expectedDeliveryDate,
      gestationalAge,
      trimester
    };
  }
}
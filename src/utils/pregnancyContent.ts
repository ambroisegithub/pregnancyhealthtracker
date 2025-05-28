export class PregnancyContent {
  static getWeeklyContent(week: number): { title: string; content: string; tips: string[] } {
    const weeklyData: { [key: number]: { title: string; content: string; tips: string[] } } = {
      4: {
        title: "Week 4: The Journey Begins",
        content:
          "Your baby is now the size of a poppy seed! The neural tube, which will become your baby's brain and spinal cord, is forming. This is a critical time for development.",
        tips: [
          "Start taking prenatal vitamins with folic acid",
          "Avoid alcohol, smoking, and recreational drugs",
          "Schedule your first prenatal appointment",
          "Begin tracking your symptoms",
        ],
      },
      8: {
        title: "Week 8: Heart Beats Strong",
        content:
          "Your baby's heart is now beating at about 150-170 beats per minute! Facial features are becoming more defined, and tiny fingers and toes are forming.",
        tips: [
          "Continue prenatal vitamins",
          "Stay hydrated - aim for 8-10 glasses of water daily",
          "Eat small, frequent meals to combat nausea",
          "Get plenty of rest",
        ],
      },
      12: {
        title: "Week 12: First Trimester Complete!",
        content:
          "Congratulations! You've completed your first trimester. Your baby is now about 2 inches long and weighs about half an ounce. The risk of miscarriage drops significantly.",
        tips: [
          "Consider sharing your pregnancy news",
          "Schedule your first ultrasound if you haven't already",
          "Start thinking about prenatal classes",
          "Continue healthy eating habits",
        ],
      },
      16: {
        title: "Week 16: Feeling the Flutter",
        content:
          "You might start feeling your baby's first movements! These early movements often feel like gentle flutters or bubbles. Your baby can now hear sounds from outside the womb.",
        tips: [
          "Talk and sing to your baby",
          "Start doing pelvic floor exercises",
          "Consider maternity clothes shopping",
          "Schedule your anatomy scan",
        ],
      },
      20: {
        title: "Week 20: Halfway There!",
        content:
          "You're halfway through your pregnancy! Your baby is about the size of a banana and weighs around 10 ounces. This is typically when you'll have your detailed anatomy scan.",
        tips: [
          "Attend your anatomy scan appointment",
          "Start planning the nursery",
          "Consider creating a birth plan",
          "Take progress photos",
        ],
      },
      24: {
        title: "Week 24: Viability Milestone",
        content:
          "Your baby has reached the age of viability! While still very premature, babies born at 24 weeks have a chance of survival with intensive medical care. Your baby's hearing is now fully developed.",
        tips: [
          "Schedule your glucose screening test",
          "Start counting daily kick counts",
          "Consider childbirth classes",
          "Plan your maternity leave",
        ],
      },
      28: {
        title: "Week 28: Third Trimester Begins",
        content:
          "Welcome to your third trimester! Your baby's brain is developing rapidly, and they're practicing breathing movements. You'll now have more frequent prenatal appointments.",
        tips: [
          "Get your Tdap vaccine",
          "Start preparing your hospital bag",
          "Practice relaxation techniques",
          "Monitor baby's movements daily",
        ],
      },
      32: {
        title: "Week 32: Rapid Growth Phase",
        content:
          "Your baby is gaining weight rapidly and their bones are hardening. You might notice more frequent Braxton Hicks contractions as your body prepares for labor.",
        tips: [
          "Attend childbirth classes",
          "Practice breathing exercises",
          "Prepare siblings for baby's arrival",
          "Finalize pediatrician choice",
        ],
      },
      36: {
        title: "Week 36: Full Term Approaching",
        content:
          "Your baby is considered full-term at 37 weeks! Their lungs are nearly mature, and they're gaining about an ounce per day. You'll now have weekly prenatal appointments.",
        tips: [
          "Complete hospital bag packing",
          "Install car seat and have it inspected",
          "Prepare freezer meals",
          "Review birth plan with your partner",
        ],
      },
      40: {
        title: "Week 40: Due Date Arrival",
        content:
          "Your due date is here! Remember, only about 5% of babies arrive exactly on their due date. Your baby is ready to meet you whenever they decide to make their grand entrance.",
        tips: [
          "Stay calm and patient",
          "Continue monitoring baby's movements",
          "Rest as much as possible",
          "Trust your body and your baby",
        ],
      },
    }

    return (
      weeklyData[week] || {
        title: `Week ${week}: Your Pregnancy Journey`,
        content:
          "Every week of pregnancy brings new developments and changes. Stay connected with your healthcare provider and trust your body's amazing ability to nurture your growing baby.",
        tips: [
          "Continue prenatal vitamins",
          "Stay hydrated and eat nutritiously",
          "Get adequate rest",
          "Attend all prenatal appointments",
        ],
      }
    )
  }

  static getTrimesterOverview(trimester: number): { title: string; content: string; keyPoints: string[] } {
    const trimesterData: { [key: number]: { title: string; content: string; keyPoints: string[] } } = {
      1: {
        title: "First Trimester: Foundation Building",
        content:
          "The first trimester is a time of incredible development. Your baby's major organs and body systems are forming, making this a critical period for healthy development.",
        keyPoints: [
          "Take folic acid to prevent neural tube defects",
          "Avoid alcohol, smoking, and harmful substances",
          "Manage morning sickness with small, frequent meals",
          "Get plenty of rest as your body adjusts",
        ],
      },
      2: {
        title: "Second Trimester: The Golden Period",
        content:
          "Often called the 'golden trimester,' this period typically brings increased energy and reduced nausea. Your baby's movements become noticeable, and you'll have important screening tests.",
        keyPoints: [
          "Enjoy increased energy levels",
          "Feel your baby's first movements",
          "Complete important screening tests",
          "Start planning for baby's arrival",
        ],
      },
      3: {
        title: "Third Trimester: Final Preparations",
        content:
          "Your baby is growing rapidly and preparing for life outside the womb. This trimester focuses on final preparations for birth and ensuring your baby reaches full maturity.",
        keyPoints: [
          "Attend more frequent prenatal appointments",
          "Prepare for labor and delivery",
          "Complete baby preparations",
          "Monitor baby's movements closely",
        ],
      },
    }

    return (
      trimesterData[trimester] || {
        title: "Your Pregnancy Journey",
        content: "Each stage of pregnancy brings unique experiences and developments.",
        keyPoints: ["Stay healthy", "Follow medical advice", "Prepare for baby"],
      }
    )
  }
}

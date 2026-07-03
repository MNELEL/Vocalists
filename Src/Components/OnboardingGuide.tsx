import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { useAppStore } from '../store/useAppStore';
import { Mic, Users, Play, ChevronLeft, ChevronRight, Check, Settings2 } from 'lucide-react';

const steps = [
  {
    title: 'ברוכים הבאים ל-VOX CLONE AI',
    description: 'מערכת מתקדמת לשיבוט קולי וניתוח דיבור. בואו נכיר את התהליך בשלושה שלבים פשוטים.',
    icon: <Settings2 className="w-12 h-12 text-primary" />,
  },
  {
    title: 'שלב 1: הקלטת שמע',
    description: 'עברו ללשונית "הקלטת שמע", ולחצו על כפתור ההקלטה כדי ללכוד דגימת קול. השתדלו לדבר ברור וללא רעשי רקע, ולאחר מכן שמרו כטיוטה.',
    icon: <Mic className="w-12 h-12 text-blue-500" />,
  },
  {
    title: 'שלב 2: יצירת פרופיל קול',
    description: 'בלשונית "פרופילי קול", צרו פרופיל חדש ובחרו את הטיוטה שהקלטתם כרפרנס. לאחר מכן, לחצו על "בחר פרופיל" כדי להפוך אותו לפעיל.',
    icon: <Users className="w-12 h-12 text-purple-500" />,
  },
  {
    title: 'שלב 3: סינתזת דיבור',
    description: 'היכנסו ל"אולפן סינתזה", הקלידו טקסט, כוונו את פרמטרי הקול ולחצו על "צור דיבור". המערכת תייצר קטע שמע חדש בקול שלכם!',
    icon: <Play className="w-12 h-12 text-green-500" />,
  }
];

export default function OnboardingGuide() {
  const { hasSeenOnboarding, setHasSeenOnboarding } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Show only once if not seen
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasSeenOnboarding]);

  const handleClose = () => {
    setIsOpen(false);
    setHasSeenOnboarding(true);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(curr => curr + 1);
    } else {
      handleClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(curr => curr - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
    }}>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">{steps[currentStep].title}</DialogTitle>
          <DialogDescription className="text-center pt-2">
            הדרכה קצרה למשתמשים חדשים
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-6 min-h-[200px] space-y-6 text-center">
          <div className="p-4 bg-muted/30 rounded-full">
            {steps[currentStep].icon}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed px-4">
            {steps[currentStep].description}
          </p>
        </div>

        <div className="flex justify-center gap-1.5 mb-4">
          {steps.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1.5 rounded-full transition-all ${idx === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-muted'}`}
            />
          ))}
        </div>

        <DialogFooter className="flex sm:justify-between flex-row items-center w-full gap-2 pt-2 border-t border-border mt-4">
          <Button 
            variant="ghost" 
            onClick={handleClose}
            className="text-muted-foreground"
          >
            דלג
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={prevStep} 
              disabled={currentStep === 0}
              size="icon"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button onClick={nextStep}>
              {currentStep === steps.length - 1 ? (
                <><Check className="w-4 h-4 ml-2" /> סיום</>
              ) : (
                <>הבא <ChevronLeft className="w-4 h-4 mr-2" /></>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

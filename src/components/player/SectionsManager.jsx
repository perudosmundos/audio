import React, { useState } from 'react';
import { Edit, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const SectionsManager = ({ sections, currentTime, onSectionsChange, onSectionJump, formatTime, episodeId }) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentSectionData, setCurrentSectionData] = useState(null);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const { toast } = useToast();

  const handleAddSection = () => {
    setCurrentSectionData({
      id: `temp-${Date.now()}`, 
      time: parseFloat(currentTime.toFixed(2)),
      title: '',
      description: ''
    });
    setIsAddingSection(true);
    setIsEditDialogOpen(true);
  };

  const handleEditSection = (section) => {
    setCurrentSectionData({ ...section, time: parseFloat(section.time.toFixed(2)) });
    setIsAddingSection(false);
    setIsEditDialogOpen(true);
  };

  const handleSaveSection = () => {
    if (!currentSectionData.title.trim()) {
      toast({
        title: "Ошибка",
        description: "Название раздела не может быть пустым.",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(currentSectionData.time) || currentSectionData.time < 0) {
       toast({
        title: "Ошибка",
        description: "Время раздела указано неверно.",
        variant: "destructive",
      });
      return;
    }


    let updatedSections;
    if (isAddingSection) {
      const newSection = { ...currentSectionData, id: `${episodeId}-section-${Date.now()}`};
      updatedSections = [...sections, newSection].sort((a, b) => a.time - b.time);
    } else {
      updatedSections = sections.map(s => 
        s.id === currentSectionData.id ? { ...currentSectionData } : s
      ).sort((a,b) => a.time - b.time);
    }

    onSectionsChange(updatedSections);
    setIsEditDialogOpen(false);
    toast({
      title: "Раздел сохранен",
      description: `Раздел "${currentSectionData.title}" успешно сохранен.`,
    });
  };

  const handleDeleteSection = (sectionId) => {
    const updatedSections = sections.filter(s => s.id !== sectionId);
    onSectionsChange(updatedSections);
    setIsEditDialogOpen(false);
     toast({
      title: "Раздел удален",
      description: "Раздел успешно удален.",
    });
  };
  
  const activeSection = sections
    .filter(section => section.time <= currentTime)
    .sort((a, b) => b.time - a.time)[0] || null;

  return (
    <>
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 md:p-4 mt-4 md:mt-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-sm md:text-base">Текущий раздел</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleAddSection}
            className="text-white hover:text-white/80 hover:bg-white/10 text-xs md:text-sm"
            aria-label="Добавить новый раздел"
          >
            <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
            Добавить
          </Button>
        </div>
        
        {activeSection ? (
          <div className="bg-white/5 rounded p-2 md:p-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-sm md:text-base">{activeSection.title}</h4>
                <p className="text-xs md:text-sm text-white/80">{formatTime(activeSection.time)}</p>
                {activeSection.description && (
                  <p className="text-xs mt-1 line-clamp-2">{activeSection.description}</p>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleEditSection(activeSection)}
                className="text-white hover:text-white/80 hover:bg-white/10 h-7 w-7 md:h-8 md:w-8"
                aria-label="Редактировать текущий раздел"
              >
                <Edit className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-white/70 text-xs md:text-sm">Нет активного раздела. Добавьте новый.</p>
        )}
      </div>

      <div className="mt-3 md:mt-4">
        <h3 className="font-semibold text-sm md:text-base mb-2">Все разделы ({sections.length})</h3>
        {sections.length > 0 ? (
          <div className="space-y-1.5 md:space-y-2 max-h-48 md:max-h-60 overflow-y-auto pr-1 md:pr-2">
            {sections.map((section) => (
              <div 
                key={section.id}
                className={`p-2 rounded flex justify-between items-center cursor-pointer text-xs md:text-sm ${
                  activeSection?.id === section.id 
                    ? 'bg-white/20' 
                    : 'bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => onSectionJump(section.time)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && onSectionJump(section.time)}
              >
                <div className="flex items-center gap-2">
                  <div className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatTime(section.time)}
                  </div>
                  <span className="font-medium line-clamp-1">{section.title}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditSection(section);
                  }}
                  className="text-white/70 hover:text-white hover:bg-white/10 h-6 w-6 md:h-7 md:w-7"
                  aria-label={`Редактировать раздел ${section.title}`}
                >
                  <Edit className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/70 text-xs md:text-sm">Разделы еще не добавлены.</p>
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isAddingSection ? 'Добавить раздел' : 'Редактировать раздел'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="section-time" className="text-right col-span-1">Время</Label>
              <Input
                id="section-time"
                type="number"
                step="0.01"
                value={currentSectionData?.time || ''}
                onChange={(e) => setCurrentSectionData({
                  ...currentSectionData,
                  time: parseFloat(e.target.value)
                })}
                className="bg-gray-800 border-gray-700 col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="section-title" className="text-right col-span-1">Название</Label>
              <Input
                id="section-title"
                value={currentSectionData?.title || ''}
                onChange={(e) => setCurrentSectionData({
                  ...currentSectionData,
                  title: e.target.value
                })}
                className="bg-gray-800 border-gray-700 col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="section-description" className="text-right col-span-1">Описание</Label>
              <Input
                id="section-description"
                value={currentSectionData?.description || ''}
                onChange={(e) => setCurrentSectionData({
                  ...currentSectionData,
                  description: e.target.value
                })}
                className="bg-gray-800 border-gray-700 col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row justify-between mt-2">
            {!isAddingSection && currentSectionData && (
              <Button 
                variant="destructive" 
                onClick={() => handleDeleteSection(currentSectionData.id)}
                className="w-full sm:w-auto mb-2 sm:mb-0"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Удалить
              </Button>
            )}
            <Button onClick={handleSaveSection} className="w-full sm:w-auto sm:ml-auto">
              <Save className="h-4 w-4 mr-1" />
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SectionsManager;
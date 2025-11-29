import { Dialog, DialogContent } from "@/components/ui/dialog";
import AdvancedSearch from "./AdvancedSearch";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModal = ({ isOpen, onClose }: SearchModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-6 bg-background/95 backdrop-blur-xl border-border/50">
        <AdvancedSearch onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
};

export default SearchModal;

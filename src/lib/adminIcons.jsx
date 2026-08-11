// Centralized icon set for the Admin / Moderator panel.
//
// Every icon here comes from Lucide (lucide-react) — the same library
// already used by src/lib/examineeIcons.jsx — wrapped with the same
// default size/stroke so the Admin & Moderator UI matches the Examinee
// panel's visual language. Only imported by Admin/Moderator-side
// components (ModeratorDashboard, ModeratorOverview, QuestionBankPage,
// CategoriesPage, ExamBuilderPage, ExamSchedulePage, NoticeBoardAdminPage,
// StaffChatInbox, PaymentAdminPage, NotificationBell).
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Bell,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Dices,
  Download,
  Edit3,
  FileText,
  FolderTree,
  HelpCircle,
  Image,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Package,
  Paperclip,
  Pencil,
  Pin,
  Settings,
  Target,
  X,
} from 'lucide-react';

const DEFAULT_SIZE = 18;
const DEFAULT_STROKE = 1.75;

function withDefaults(LucideIcon) {
  function AdminIcon({ size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE, ...rest }) {
    return <LucideIcon size={size} strokeWidth={strokeWidth} {...rest} />;
  }
  return AdminIcon;
}

export const IconAlertTriangle = withDefaults(AlertTriangle);
export const IconArchive = withDefaults(Archive);
export const IconArrowLeft = withDefaults(ArrowLeft);
export const IconBell = withDefaults(Bell);
export const IconBookOpen = withDefaults(BookOpen);
export const IconCalendar = withDefaults(Calendar);
export const IconCheck = withDefaults(Check);
export const IconCheckCircle = withDefaults(CheckCircle2);
export const IconClock = withDefaults(Clock);
export const IconCreditCard = withDefaults(CreditCard);
export const IconDices = withDefaults(Dices);
export const IconDownload = withDefaults(Download);
export const IconEdit3 = withDefaults(Edit3);
export const IconFileText = withDefaults(FileText);
export const IconFolderTree = withDefaults(FolderTree);
export const IconHelpCircle = withDefaults(HelpCircle);
export const IconImage = withDefaults(Image);
export const IconLayoutDashboard = withDefaults(LayoutDashboard);
export const IconLightbulb = withDefaults(Lightbulb);
export const IconMegaphone = withDefaults(Megaphone);
export const IconMessageCircle = withDefaults(MessageCircle);
export const IconPackage = withDefaults(Package);
export const IconPaperclip = withDefaults(Paperclip);
export const IconPencil = withDefaults(Pencil);
export const IconPin = withDefaults(Pin);
export const IconSettings = withDefaults(Settings);
export const IconTarget = withDefaults(Target);
export const IconX = withDefaults(X);

// Centralized icon set for the Examinee panel.
//
// Every icon the student-facing UI uses comes from Lucide (lucide-react),
// wrapped here so stroke width and default size stay identical everywhere
// they appear. This file is only imported by examinee-side components —
// Moderator/Admin/Super Admin panels keep their existing emoji icons and
// are untouched by this change.
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  BookOpen,
  Bug,
  Check,
  CheckCircle2,
  ClipboardList,
  Download,
  Gift,
  Globe,
  Hand,
  Heart,
  HelpCircle,
  Home,
  Lightbulb,
  Library,
  Link,
  Lock,
  Mail,
  Mailbox,
  Megaphone,
  MessageCircle,
  Package,
  Paperclip,
  Phone,
  Pin,
  RotateCcw,
  Search,
  Send,
  Settings,
  Star,
  Stethoscope,
  Target,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';

const DEFAULT_SIZE = 18;
const DEFAULT_STROKE = 1.75;

function withDefaults(LucideIcon) {
  function ExamineeIcon({ size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE, ...rest }) {
    return <LucideIcon size={size} strokeWidth={strokeWidth} {...rest} />;
  }
  return ExamineeIcon;
}

export const IconArrowLeft = withDefaults(ArrowLeft);
export const IconArrowRight = withDefaults(ArrowRight);
export const IconBell = withDefaults(Bell);
export const IconBookmark = withDefaults(Bookmark);
export const IconBookOpen = withDefaults(BookOpen);
export const IconBug = withDefaults(Bug);
export const IconCheck = withDefaults(Check);
export const IconCheckCircle = withDefaults(CheckCircle2);
export const IconClipboardList = withDefaults(ClipboardList);
export const IconDownload = withDefaults(Download);
export const IconGift = withDefaults(Gift);
export const IconGlobe = withDefaults(Globe);
export const IconHand = withDefaults(Hand);
export const IconHeart = withDefaults(Heart);
export const IconHelpCircle = withDefaults(HelpCircle);
export const IconHome = withDefaults(Home);
export const IconLightbulb = withDefaults(Lightbulb);
export const IconLibrary = withDefaults(Library);
export const IconLink = withDefaults(Link);
export const IconLock = withDefaults(Lock);
export const IconMail = withDefaults(Mail);
export const IconMailbox = withDefaults(Mailbox);
export const IconMegaphone = withDefaults(Megaphone);
export const IconMessageCircle = withDefaults(MessageCircle);
export const IconPackage = withDefaults(Package);
export const IconPaperclip = withDefaults(Paperclip);
export const IconPhone = withDefaults(Phone);
export const IconPin = withDefaults(Pin);
export const IconRotateCcw = withDefaults(RotateCcw);
export const IconSearch = withDefaults(Search);
export const IconSend = withDefaults(Send);
export const IconSettings = withDefaults(Settings);
export const IconStar = withDefaults(Star);
export const IconStethoscope = withDefaults(Stethoscope);
export const IconTarget = withDefaults(Target);
export const IconUser = withDefaults(User);
export const IconUsers = withDefaults(Users);
export const IconX = withDefaults(X);
export const IconXCircle = withDefaults(XCircle);

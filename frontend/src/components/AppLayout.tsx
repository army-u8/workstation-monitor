import type { ParentComponent } from 'solid-js';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { ToastShelf } from './ToastShelf';
import { ConfirmModal } from './ConfirmModal';

export const AppLayout: ParentComponent = (props) => {
  return (
    <div class="flex h-screen w-screen overflow-hidden bg-bg-base font-sans text-text-primary antialiased selection:bg-accent-subtle selection:text-accent">
      {/* 1. Left Fixed Sidebar */}
      <Sidebar />

      {/* 2. Right Main Application View Column */}
      <div class="flex flex-1 flex-col h-screen min-w-0 overflow-hidden">
        {/* Top Fixed Header */}
        <Header />

        {/* Dynamic Scrollable Main Body */}
        <main class="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-4">
          <div class="mx-auto flex w-full max-w-[1600px] flex-col gap-3">
            {props.children}
          </div>
        </main>

        {/* Bottom Fixed Status Bar */}
        <Footer />
      </div>

      {/* Global Confirmation Modal Dialog */}
      <ConfirmModal />

      {/* Global Toast Notifications Shelf */}
      <ToastShelf />
    </div>
  );
};

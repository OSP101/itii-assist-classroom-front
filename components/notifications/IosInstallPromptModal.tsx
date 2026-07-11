"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";

interface IosInstallPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IosInstallPromptModal({ isOpen, onClose }: IosInstallPromptModalProps) {
  const t = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" backdrop="blur">
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <span className="text-lg font-semibold">{t("pushIosInstallTitle")}</span>
              <span className="text-sm text-default-500">{t("pushIosInstallSubtitle")}</span>
            </ModalHeader>
            <ModalBody>
              <ol className="space-y-4">
                <li className="flex gap-3 items-start">
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary-100 text-primary-600 font-semibold">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{t("pushIosStep1Title")}</p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-default-500">
                      <Icon icon="ph:share-fat-duotone" width={20} />
                      <span>{t("pushIosStep1Description")}</span>
                    </div>
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary-100 text-primary-600 font-semibold">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{t("pushIosStep2Title")}</p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-default-500">
                      <Icon icon="ph:plus-square-duotone" width={20} />
                      <span>{t("pushIosStep2Description")}</span>
                    </div>
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary-100 text-primary-600 font-semibold">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{t("pushIosStep3Title")}</p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-default-500">
                      <Icon icon="ph:house-duotone" width={20} />
                      <span>{t("pushIosStep3Description")}</span>
                    </div>
                  </div>
                </li>
              </ol>
              <div className="mt-4 rounded-lg bg-warning-50 p-3 text-sm text-warning-700">
                {t("pushIosNoteIos164")}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={close} variant="flat">
                {t("close")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

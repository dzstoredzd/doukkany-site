/* The 25 Doukkany video lessons: one list for every page (learn, start).
 * "Doukkany on PC" YouTube playlist, in its order.
 * Row: [video id, Arabic title, French title, English title, length in seconds, category].
 * The category is sent with tutorial_clicked (tutorial_category). */
(function (root) {
  'use strict';
  var LESSONS = {
    playlistId: 'PLATmdIDov8C4',
    videos: [
      ['l487p3PcKrs', 'أول تشغيل لدكّاني على الحاسوب', 'Premier lancement de Doukkany sur PC', 'First start of Doukkany on PC', 56, 'getting_started'],
      ['knj8FTLcriI', 'الإضافة السريعة للسلعة', 'Ajout rapide d’un produit', 'Quick add of a product', 50, 'products'],
      ['hwXBqgD0qFU', 'إضافة سلعة بالتفصيل', 'Ajouter un produit en détail', 'Add a product in detail', 61, 'products'],
      ['UiLl3WZe_iM', 'ترتيب السلع في فئات', 'Classer les produits par catégories', 'Sort products into categories', 46, 'products'],
      ['HBxeKBFIpbY', 'البيع خطوة بخطوة', 'Vendre étape par étape', 'Selling step by step', 46, 'selling'],
      ['USUIhjNc9wo', 'البيع بالدَّين', 'Vendre à crédit', 'Selling on credit', 49, 'credit'],
      ['cWWeTfazA_Y', 'البيع بتخفيض', 'Vendre avec une remise', 'Selling with a discount', 49, 'selling'],
      ['BecQxkCCNUo', 'البيع بقارئ الباركود', 'Vendre avec le lecteur de code-barres', 'Selling with a barcode scanner', 45, 'selling'],
      ['GYOgSPXsGNA', 'اختصارات لوحة المفاتيح', 'Raccourcis clavier', 'Keyboard shortcuts', 46, 'selling'],
      ['Qfl7T7-zdTM', 'عدة زبائن في وقت واحد', 'Plusieurs clients en même temps', 'Several customers at once', 45, 'selling'],
      ['nX568wrdneU', 'طابعة الإيصالات', 'Imprimante de tickets', 'Receipt printer', 45, 'printing'],
      ['oJIMUt0StMM', 'دفتر الدَّين', 'Carnet de crédit', 'Credit book', 45, 'credit'],
      ['MtRhQZSqdRw', 'إضافة عامل وصلاحياته', 'Ajouter un employé et ses droits', 'Add a staff member and their permissions', 48, 'staff'],
      ['SzjTHiWUKCY', 'الصندوق: الفتح والإغلاق', 'La caisse : ouverture et fermeture', 'Cash drawer: opening and closing', 48, 'cash'],
      ['zj5Wp16lGYE', 'حاسوب ثانٍ وهاتف في المحل', 'Un 2e ordinateur et un téléphone dans le magasin', 'A second computer and a phone in the shop', 52, 'devices'],
      ['bxlT8DnAFWY', 'التقارير والربح', 'Rapports et bénéfice', 'Reports and profit', 45, 'reports'],
      ['qDGltZh8WuM', 'تسجيل وصول السلعة', 'Enregistrer l’arrivée de marchandise', 'Recording new stock', 42, 'stock'],
      ['vgzS9v2wLVw', 'تنبيهات المخزون والصلاحية', 'Alertes de stock et de péremption', 'Stock and expiry alerts', 52, 'stock'],
      ['IXEpl-ptxuE', 'إرجاع سلعة', 'Retour d’un produit', 'Returning a product', 45, 'selling'],
      ['NriEqQDR_D8', 'طباعة الملصقات', 'Impression d’étiquettes', 'Printing labels', 41, 'printing'],
      ['C_tN8K8XnAc', 'استيراد السلع من Excel', 'Importer les produits depuis Excel', 'Import products from Excel', 37, 'products'],
      ['EH5Sdd2-Ueg', 'سعر التجزئة وسعر الجملة', 'Prix de détail et prix de gros', 'Retail and wholesale prices', 34, 'products'],
      ['sFtffw9oHFw', 'التصليحات والخدمات', 'Réparations et services', 'Repairs and services', 39, 'services'],
      ['h4q0r4vEIJg', 'نقاط الوفاء والعروض', 'Points de fidélité et offres', 'Loyalty points and offers', 38, 'loyalty'],
      ['72vZnHe9ay4', 'النسخة الاحتياطية', 'Sauvegarde', 'Backup', 48, 'backup']
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = LESSONS;
  else root.DK_LESSONS = LESSONS;
})(this);

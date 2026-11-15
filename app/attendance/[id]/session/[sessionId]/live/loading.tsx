import styles from "@/components/attendance/AttendanceProjector.module.css";

/** Live attendance monitor skeleton */
export default function Loading() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="กำลังโหลดข้อมูลเช็กชื่อ / Loading attendance">
      <div className={styles.header}><div className={styles.loadingTitle} /></div>
      <div className={styles.pinPanel}><div className={styles.loadingPin} /></div>
      <div className={styles.scan}><div className={styles.loadingQR} /></div>
      <div className={styles.summary}><p>กำลังโหลดข้อมูลเช็กชื่อ… / Loading attendance…</p></div>
    </div>
  );
}

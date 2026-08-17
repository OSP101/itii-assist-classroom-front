import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ExportSeatRow } from "@/services/examSeat.service";

let fontsRegistered = false;

export function registerExamSeatPdfFonts(origin: string) {
    if (fontsRegistered) {
        return;
    }

    Font.register({
        family: "THSarabunNewPdf",
        fonts: [
            { src: `${origin}/fonts/THSarabunNew.ttf`, fontWeight: 400 },
            { src: `${origin}/fonts/THSarabunNew-Bold.ttf`, fontWeight: 700 },
        ],
    });

    Font.registerHyphenationCallback((word) => [word]);
    fontsRegistered = true;
}

const styles = StyleSheet.create({
    page: {
        paddingTop: 14,
        paddingRight: 17,
        paddingBottom: 17,
        paddingLeft: 17,
        fontFamily: "THSarabunNewPdf",
        fontSize: 16,
        color: "#000000",
    },
    pageWrap: {
        flexDirection: "column",
        minHeight: "100%",
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    logoWrap: {
        width: 58,
        alignItems: "flex-start",
        justifyContent: "center",
    },
    logo: {
        width: 43,
        height: 72,
        objectFit: "contain",
    },
    headerCenter: {
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    headerRight: {
        width: 248,
        alignItems: "flex-end",
        justifyContent: "center",
    },
    universityText: {
        fontSize: 26,
        lineHeight: 1.05,
        fontWeight: 700,
    },
    headerDocumentTitle: {
        fontSize: 26,
        fontWeight: 700,
        lineHeight: 1.05,
        textAlign: "right",
    },
    headerRightText: {
        fontSize: 14,
        lineHeight: 1.05,
        textAlign: "right",
    },
    headerDivider: {
        borderBottomWidth: 1,
        borderColor: "#000000",
        marginBottom: 4,
    },
    infoBlock: {
        marginBottom: 8,
    },
    infoColumns: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    infoLeftColumn: {
        width: "58%",
        paddingRight: 10,
    },
    infoRightColumn: {
        width: "42%",
    },
    infoLine: {
        fontSize: 14,
        lineHeight: 1.05,
        marginBottom: 3,
    },
    seatTable: {
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: "#000000",
    },
    seatHeaderRow: {
        flexDirection: "row",
    },
    seatRow: {
        flexDirection: "row",
    },
    colIndex: { width: "8.1%" },
    colStudentId: { width: "16.1%" },
    colStudentName: { width: "32.2%" },
    colMajor: { width: "10.2%" },
    colSeat: { width: "16.1%" },
    colSign: { width: "17.3%" },
    seatHeaderCell: {
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#000000",
        backgroundColor: "#D9D9D9",
        minHeight: 27,
        paddingHorizontal: 3,
        paddingTop: 3,
        paddingBottom: 2,
        justifyContent: "center",
        alignItems: "center",
    },
    seatCell: {
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#000000",
        minHeight: 27,
        paddingHorizontal: 3,
        paddingTop: 2,
        paddingBottom: 1,
        justifyContent: "center",
    },
    seatHeaderText: {
        fontSize: 16,
        fontWeight: 700,
        textAlign: "center",
        lineHeight: 1.05,
    },
    seatTextCenter: {
        fontSize: 16,
        textAlign: "center",
        lineHeight: 1.05,
    },
    seatTextLeft: {
        fontSize: 16,
        textAlign: "left",
        lineHeight: 1.05,
    },
});

const ROWS_PER_PAGE = 24;

function chunkRows(rows: ExportSeatRow[]) {
    const pages: ExportSeatRow[][] = [];

    for (let index = 0; index < rows.length; index += ROWS_PER_PAGE) {
        pages.push(rows.slice(index, index + ROWS_PER_PAGE));
    }

    return pages.length > 0 ? pages : [[]];
}

function formatStudentCode(studentCode: string) {
    const normalized = studentCode.trim();

    if (normalized.includes("-") || !/^\d+$/.test(normalized) || normalized.length < 2) {
        return normalized;
    }

    return `${normalized.slice(0, -1)}-${normalized.slice(-1)}`;
}

interface ExamSeatPdfDocumentProps {
    logoSrc?: string;
    courseCode: string;
    courseName: string;
    semester: number;
    year: number;
    sectionLabel: string;
    examLabel: string;
    datetimeLabel: string;
    componentLabel: string;
    classroomLabel: string;
    instructorName: string;
    studentCount: number;
    rows: ExportSeatRow[];
}

function SeatHeader() {
    return (
        <View style={styles.seatHeaderRow}>
            <View style={[styles.seatHeaderCell, styles.colIndex]}>
                <Text style={styles.seatHeaderText}>ลำดับ</Text>
            </View>
            <View style={[styles.seatHeaderCell, styles.colStudentId]}>
                <Text style={styles.seatHeaderText}>รหัสประจำตัว</Text>
            </View>
            <View style={[styles.seatHeaderCell, styles.colStudentName]}>
                <Text style={styles.seatHeaderText}>ชื่อ</Text>
            </View>
            <View style={[styles.seatHeaderCell, styles.colMajor]}>
                <Text style={styles.seatHeaderText}>เอก</Text>
            </View>
            <View style={[styles.seatHeaderCell, styles.colSeat]}>
                <Text style={styles.seatHeaderText}>ห้อง-เลขที่นั่งสอบ</Text>
            </View>
            <View style={[styles.seatHeaderCell, styles.colSign]}>
                <Text style={styles.seatHeaderText}>ลงชื่อเข้าสอบ</Text>
            </View>
        </View>
    );
}

export function ExamSeatPdfDocument({
    logoSrc,
    courseCode,
    courseName,
    semester,
    year,
    sectionLabel,
    examLabel,
    datetimeLabel,
    componentLabel,
    classroomLabel,
    instructorName,
    studentCount,
    rows,
}: ExamSeatPdfDocumentProps) {
    const pages = chunkRows(rows);

    return (
        <Document
            title="รายชื่อนศ.ในรายวิชาที่สอน"
            author={instructorName || "COCO LABS"}
            subject={courseName}
            creator="COCO LABS"
            producer="COCO LABS"
            language="th-TH"
            pageLayout="singlePage"
            pageMode="useNone"
        >
            {pages.map((pageRows, pageIndex) => {
                const totalPages = pages.length;
                const blankRowCount = ROWS_PER_PAGE - pageRows.length;
                const campusYearLabel = `วิทยาเขต ขอนแก่น ปีการศึกษา ${semester}/${year}`;

                return (
                    <Page key={`page-${pageIndex + 1}`} size="A4" style={styles.page}>
                        <View style={styles.pageWrap}>
                            <View style={styles.headerRow}>
                                <View style={styles.logoWrap}>
                                    {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : null}
                                </View>
                                <View style={styles.headerCenter}>
                                    <Text style={styles.universityText}>มหาวิทยาลัยขอนแก่น</Text>
                                </View>
                                <View style={styles.headerRight}>
                                    <Text style={styles.headerDocumentTitle}>รายชื่อนศ.ในรายวิชาที่สอน</Text>
                                    <Text style={styles.headerRightText}>{campusYearLabel}</Text>
                                    <Text style={styles.headerRightText}>ระดับการศึกษา ปริญญาตรี โครงการพิเศษ</Text>
                                </View>
                            </View>
                            <View style={styles.headerDivider} />

                            <View style={styles.infoBlock}>
                                <View style={styles.infoColumns}>
                                    <View style={styles.infoLeftColumn}>
                                        <Text style={styles.infoLine}>
                                            <Text style={{ fontWeight: 700 }}>รายวิชา </Text>
                                            <Text>{courseCode || "-"} </Text>
                                            <Text>{courseName || "-"}</Text>
                                        </Text>
                                        <Text style={styles.infoLine}>
                                            <Text style={{ fontWeight: 700 }}>กลุ่มที่ </Text>
                                            <Text>{sectionLabel || "-"} </Text>
                                            <Text style={{ fontWeight: 700 }}>ห้องสอบ </Text>
                                            <Text>{classroomLabel || "-"}</Text>
                                        </Text>
                                        <Text style={styles.infoLine}>
                                            <Text style={{ fontWeight: 700 }}>ภาคการสอน </Text>
                                            <Text>{componentLabel || "-"}</Text>
                                        </Text>
                                    </View>
                                    <View style={styles.infoRightColumn}>
                                        <Text style={styles.infoLine}>
                                            <Text style={{ fontWeight: 700 }}>อาจารย์ผู้สอน </Text>
                                            <Text>{instructorName || "-"}</Text>
                                        </Text>
                                        <Text style={styles.infoLine}>
                                            <Text style={{ fontWeight: 700 }}>{examLabel}</Text>
                                        </Text>
                                        <Text style={styles.infoLine}>
                                            <Text style={{ fontWeight: 700 }}>วันเวลาสอบ </Text>
                                            <Text>{datetimeLabel || "-"}</Text>
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.seatTable}>
                                <SeatHeader />
                                {pageRows.map((row, rowIndex) => (
                                    <View key={`row-${pageIndex}-${row.row_num}`} style={styles.seatRow}>
                                        <View style={[styles.seatCell, styles.colIndex]}>
                                            <Text style={styles.seatTextCenter}>{(pageIndex * ROWS_PER_PAGE) + rowIndex + 1}.</Text>
                                        </View>
                                        <View style={[styles.seatCell, styles.colStudentId]}>
                                            <Text style={styles.seatTextLeft}>{formatStudentCode(row.student_id)}</Text>
                                        </View>
                                        <View style={[styles.seatCell, styles.colStudentName]}>
                                            <Text style={styles.seatTextLeft}>{row.full_name}</Text>
                                        </View>
                                        <View style={[styles.seatCell, styles.colMajor]}>
                                            <Text style={styles.seatTextCenter}>{row.major || ""}</Text>
                                        </View>
                                        <View style={[styles.seatCell, styles.colSeat]}>
                                            <Text style={styles.seatTextCenter}>{row.seat_label}</Text>
                                        </View>
                                        <View style={[styles.seatCell, styles.colSign]}>
                                            <Text style={styles.seatTextCenter}> </Text>
                                        </View>
                                    </View>
                                ))}
                                {Array.from({ length: blankRowCount }).map((_, blankIndex) => (
                                    <View key={`blank-${pageIndex}-${blankIndex}`} style={styles.seatRow}>
                                        <View style={[styles.seatCell, styles.colIndex]}>
                                            <Text style={styles.seatTextCenter}>{(pageIndex * ROWS_PER_PAGE) + pageRows.length + blankIndex + 1}.</Text>
                                        </View>
                                        <View style={[styles.seatCell, styles.colStudentId]}><Text style={styles.seatTextLeft}> </Text></View>
                                        <View style={[styles.seatCell, styles.colStudentName]}><Text style={styles.seatTextLeft}> </Text></View>
                                        <View style={[styles.seatCell, styles.colMajor]}><Text style={styles.seatTextCenter}> </Text></View>
                                        <View style={[styles.seatCell, styles.colSeat]}><Text style={styles.seatTextCenter}> </Text></View>
                                        <View style={[styles.seatCell, styles.colSign]}><Text style={styles.seatTextCenter}> </Text></View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </Page>
                );
            })}
        </Document>
    );
}
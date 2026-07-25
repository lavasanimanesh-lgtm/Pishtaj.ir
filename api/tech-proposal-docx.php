<?php
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$ref = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($ref && $host && parse_url($ref, PHP_URL_HOST) !== $host) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Cross-origin blocked';
    exit;
}

if (!class_exists('ZipArchive')) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'ZipArchive is not available on the server';
    exit;
}

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$p = $in['proposal'] ?? null;
if (!$p || !is_array($p)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid proposal payload';
    exit;
}

function tp_clean($v, $max = 12000) {
    $v = trim((string)$v);
    $v = preg_replace('/\s+/u', ' ', $v);
    if (function_exists('mb_substr')) return mb_substr($v, 0, $max, 'UTF-8');
    return substr($v, 0, $max);
}
function tp_xml($s) {
    return htmlspecialchars((string)$s, ENT_XML1 | ENT_COMPAT, 'UTF-8');
}
function tp_paragraph($text, $style = null, $bold = false) {
    $text = tp_clean($text);
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $parts = explode("\n", $text);
    $out = '';
    foreach ($parts as $ln) {
        if ($ln === '') $ln = ' ';
        $pPr = $style ? '<w:pPr><w:pStyle w:val="' . tp_xml($style) . '"/></w:pPr>' : '';
        $rPr = $bold ? '<w:rPr><w:b/></w:rPr>' : '';
        $out .= '<w:p>' . $pPr . '<w:r>' . $rPr . '<w:t xml:space="preserve">' . tp_xml($ln) . '</w:t></w:r></w:p>';
    }
    return $out;
}
function tp_table($headers, $rows) {
    $tbl = '<w:tbl>' .
        '<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>' .
        '<w:tblGrid>';
    $cols = max(1, count($headers));
    for ($i = 0; $i < $cols; $i++) $tbl .= '<w:gridCol w:w="2400"/>';
    $tbl .= '</w:tblGrid>';

    $tbl .= '<w:tr>';
    foreach ($headers as $h) {
        $tbl .= '<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>' .
            '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>' . tp_xml($h) . '</w:t></w:r></w:p></w:tc>';
    }
    $tbl .= '</w:tr>';

    foreach ($rows as $r) {
        $tbl .= '<w:tr>';
        foreach ($headers as $idx => $_) {
            $val = is_array($r) ? ($r[$idx] ?? '') : '';
            $tbl .= '<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>' .
                tp_paragraph($val) . '</w:tc>';
        }
        $tbl .= '</w:tr>';
    }
    $tbl .= '</w:tbl>';
    return $tbl;
}

$title = tp_clean($p['title'] ?? 'Technical Proposal', 200);
$docNo = tp_clean($p['docNo'] ?? 'TP-DRAFT', 120);
$requestNo = tp_clean($p['requestNo'] ?? '', 120);
$versionLabel = tp_clean($p['versionLabel'] ?? '', 80);
$date = tp_clean($p['date'] ?? date('Y-m-d'), 80);
$customer = tp_clean($p['customer'] ?? '', 240);
$caseNo = tp_clean($p['caseNo'] ?? '', 120);
$analysisVer = tp_clean((string)($p['basedOnAnalysisVer'] ?? ''), 40);
$calcRun = tp_clean($p['basedOnCalcRunNo'] ?? '', 120);
$company = tp_clean($p['company'] ?? 'Pishro Tajhiz Fartak Co.', 240);
$website = tp_clean($p['website'] ?? '', 120);
$email = tp_clean($p['email'] ?? '', 120);
$tel = tp_clean($p['tel'] ?? '', 120);
$sections = is_array($p['sections'] ?? null) ? $p['sections'] : [];
$processRows = is_array($p['processRows'] ?? null) ? $p['processRows'] : [];
$calcOutputRows = is_array($p['calcOutputRows'] ?? null) ? $p['calcOutputRows'] : [];
$calcFormulaRows = is_array($p['calcFormulaRows'] ?? null) ? $p['calcFormulaRows'] : [];
$complianceRows = is_array($p['complianceRows'] ?? null) ? $p['complianceRows'] : [];
$warnings = is_array($p['warnings'] ?? null) ? $p['warnings'] : [];
$standards = is_array($p['standards'] ?? null) ? $p['standards'] : [];
$equipmentType = tp_clean($p['equipmentType'] ?? '', 200);
$serviceContext = tp_clean($p['serviceContext'] ?? '', 300);

$body = '';
$body .= tp_paragraph($company, 'Title');
$body .= tp_paragraph($title, 'Heading1');
$body .= tp_paragraph('Proposal No: ' . $docNo . '    Request No: ' . $requestNo . '    Date: ' . $date . '    Version: ' . $versionLabel);
$body .= tp_paragraph('Customer: ' . $customer . '    Technical Case: ' . $caseNo . '    Analysis Version: ' . $analysisVer . '    Calc Run: ' . $calcRun);
if ($website || $email || $tel) $body .= tp_paragraph(trim($website . '    ' . $email . '    ' . $tel));

if ($warnings) {
    $body .= tp_paragraph('Open Review Notes', 'Heading2');
    foreach ($warnings as $w) $body .= tp_paragraph('- ' . tp_clean($w), null, false);
}

$body .= tp_paragraph('Executive Summary', 'Heading2');
$body .= tp_paragraph($sections['executiveSummary'] ?? '');

$body .= tp_paragraph('Process Data', 'Heading2');
$body .= tp_table(['Parameter', 'Value'], $processRows ?: [['No structured process row', 'Pending']]);

$body .= tp_paragraph('Design Basis', 'Heading2');
$body .= tp_paragraph($sections['designBasis'] ?? '');
$body .= tp_paragraph('Equipment Type: ' . $equipmentType);
$body .= tp_paragraph('Service Context: ' . $serviceContext);
$body .= tp_paragraph('Standards: ' . ($standards ? implode(', ', array_map('tp_clean', $standards)) : '—'));

$body .= tp_paragraph('Engineering Calculations', 'Heading2');
$body .= tp_paragraph('The engineering calculations attached to this proposal are deterministic and stored in the CRM for traceability. No hidden assumptions or LLM-generated calculations have been used.');
$body .= tp_table(['Metric', 'Value'], $calcOutputRows ?: [['No calculation data', 'Pending']]);

$body .= tp_paragraph('Calculation Tables', 'Heading2');
$body .= tp_table(['Step', 'Formula', 'Value', 'Note'], $calcFormulaRows ?: [['No formula log', '', '', '']]);

$body .= tp_paragraph('Charts and Graphs', 'Heading2');
$body .= tp_paragraph('This DOCX export provides the structured numerical package. Visual charts remain available in the CRM HTML/PDF preview output.');

$body .= tp_paragraph('Equipment Selection Logic', 'Heading2');
$body .= tp_paragraph($sections['equipmentSelectionLogic'] ?? '');

$body .= tp_paragraph('Recommended Model', 'Heading2');
$body .= tp_paragraph($sections['recommendedModel'] ?? '');

$body .= tp_paragraph('Technical Compliance Matrix', 'Heading2');
$body .= tp_table(['Requirement / Reference', 'Status', 'Note'], $complianceRows ?: [['Technical case content', 'Pending', 'No structured row available']]);

$body .= tp_paragraph('Deviations', 'Heading2');
$body .= tp_paragraph($sections['deviations'] ?? '');

$body .= tp_paragraph('Conclusion', 'Heading2');
$body .= tp_paragraph($sections['conclusion'] ?? '');

$body .= '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>';

$documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">'
    . '<w:body>' . $body . '</w:body></w:document>';

$stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    . '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    . '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style>'
    . '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>'
    . '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>'
    . '</w:styles>';

$contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    . '<Default Extension="xml" ContentType="application/xml"/>'
    . '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    . '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    . '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
    . '</Types>';

$rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    . '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
    . '</Relationships>';

$core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    . '<dc:title>' . tp_xml($docNo) . '</dc:title>'
    . '<dc:creator>' . tp_xml($company) . '</dc:creator>'
    . '<cp:lastModifiedBy>' . tp_xml($company) . '</cp:lastModifiedBy>'
    . '<dcterms:created xsi:type="dcterms:W3CDTF">' . gmdate('Y-m-d\TH:i:s\Z') . '</dcterms:created>'
    . '<dcterms:modified xsi:type="dcterms:W3CDTF">' . gmdate('Y-m-d\TH:i:s\Z') . '</dcterms:modified>'
    . '</cp:coreProperties>';

$app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    . '<Application>PTF CRM</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company>' . tp_xml($company) . '</Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>22.3</AppVersion>'
    . '</Properties>';

$tmp = tempnam(sys_get_temp_dir(), 'ptf_tp_');
$docx = $tmp . '.docx';
@unlink($tmp);
$zip = new ZipArchive();
if ($zip->open($docx, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Cannot create DOCX package';
    exit;
}
$zip->addFromString('[Content_Types].xml', $contentTypes);
$zip->addFromString('_rels/.rels', $rels);
$zip->addFromString('docProps/core.xml', $core);
$zip->addFromString('docProps/app.xml', $app);
$zip->addFromString('word/document.xml', $documentXml);
$zip->addFromString('word/styles.xml', $stylesXml);
$zip->close();

header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
header('Content-Disposition: attachment; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', $docNo) . '.docx"');
header('Content-Length: ' . filesize($docx));
readfile($docx);
@unlink($docx);
exit;

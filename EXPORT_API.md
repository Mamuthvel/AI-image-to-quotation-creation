# CSV Export API Documentation

The Limras Quotation system now includes three CSV export endpoints for integration with ERP systems like KGM Store ERP. All endpoints return RFC 4180 compliant CSV files with proper escaping of special characters.

## Endpoints

### 1. Export Single Quotation as CSV

**Endpoint:** `GET /api/quotations/:id/export/csv`

**Description:** Exports a single quotation as a detailed CSV file with metadata and line items.

**Parameters:**
- `id` (path, required): Quotation ID

**Response:**
- Content-Type: `text/csv`
- Filename: `quotation-{doc_number}-{timestamp}.csv`

**Format:**
```
QUOTATION_METADATA,Type,Value
,Quote Number,6885
,Customer,ABC Corp
,Salesman,John Doe
,Price Category,list
,Created Date,2026-08-20T09:24:15.103Z
,Issued Date,2026-08-20T09:24:15.103Z
,Status,issued
,Total (before roundoff),13480.25
,Round Off,-0.25
,Grand Total,13480

SKU,Item Name,Brand,Category,UOM,Quantity,Rate,Line Total
RS-GM-55,"GM 5.5"" ROUND SHEET WHITE",BRAND_NAME,CATEGORY_NAME,Nos,12,62,744
```

**Example:**
```bash
curl "http://localhost:3000/api/quotations/1/export/csv" \
  -o quotation_101.csv
```

---

### 2. Bulk Export Multiple Quotations

**Endpoint:** `GET /api/quotations/export/csv`

**Description:** Exports all or filtered quotations in a flat list format. Each line item is tagged with its source quotation number for traceability. Ideal for importing multiple quotations into an ERP system in bulk.

**Query Parameters:**
- `status` (optional): Filter by status - `draft` or `issued`
- `limit` (optional): Maximum number of quotations to export (default: 200)
- `startDate` (optional): Filter quotations created >= this ISO8601 date
- `endDate` (optional): Filter quotations created <= this ISO8601 date

**Response:**
- Content-Type: `text/csv`
- Filename: `quotations-bulk-{YYYY-MM-DD}.csv`

**Format:**
```
Source Quote Number,Source Customer,Source Salesman,Source Date,SKU,Item Name,Brand,Category,UOM,Quantity,Rate,Line Total,Price Category,Quote Status
6885,muthu,faisal,2026-08-20T09:24:15.103Z,RS-GM-55,"GM 5.5"" ROUND SHEET WHITE",BRAND,CATEGORY,Nos,12,62,744,list,issued
6885,muthu,faisal,2026-08-20T09:24:15.103Z,RS-GM-35,"GM 3.5"" ROUND SHEET WHITE",BRAND,CATEGORY,Nos,12,32,384,list,issued
6886,QUOTATION,DIRECT SMAN,2026-08-26T08:26:08.256Z,KWC1009,FR 1.5 Sq.mm (22/0.3) - 45 Mtr Coil,KUNDAN,CATEGORY,Coil,12,1201.51,14418.12,list,issued
```

**Examples:**
```bash
# Export all quotations
curl "http://localhost:3000/api/quotations/export/csv" \
  -o quotations_all.csv

# Export only issued quotations from last 30 days
curl "http://localhost:3000/api/quotations/export/csv?status=issued&startDate=2026-07-27" \
  -o quotations_recent.csv

# Export maximum 50 quotations
curl "http://localhost:3000/api/quotations/export/csv?limit=50" \
  -o quotations_50.csv

# Export quotations between specific dates
curl "http://localhost:3000/api/quotations/export/csv?startDate=2026-08-01&endDate=2026-08-31" \
  -o quotations_august.csv
```

---

### 3. Export Product Catalog

**Endpoint:** `GET /api/catalog/export/csv`

**Description:** Exports the complete product master with SKU, name, brand, category, pricing, and structured attributes. Useful for comparing with ERP's product catalog or bulk importing products.

**Query Parameters:**
- `category` (optional): Filter by category (e.g., `FR`, `CTS_CU`, `SWITCH_20A`)

**Response:**
- Content-Type: `text/csv`
- Filename: `catalog-{YYYY-MM-DD}.csv`

**Format:**
```
SKU,Name,Brand,Category,UOM,List Price,Popularity,Attributes (JSON)
KWC1009,FR 1.5 Sq.mm (22/0.3) - 45 Mtr Coil,KUNDAN CAB,FR,Coil,2267,50,"{""coreSqmm"":1.5,""strand"":""22/0.3"",""lengthMtr"":45}"
RS-GM-55,GM 5.5" ROUND SHEET WHITE,BRAND,SHEET,Nos,62,85,"{""size"":""5.5 inch"",""colour"":""white""}"
```

**Examples:**
```bash
# Export entire catalog
curl "http://localhost:3000/api/catalog/export/csv" \
  -o catalog_complete.csv

# Export only FR (Fire Resistant) cable category
curl "http://localhost:3000/api/catalog/export/csv?category=FR" \
  -o catalog_fr_cables.csv

# Export only CTS Copper category
curl "http://localhost:3000/api/catalog/export/csv?category=CTS_CU" \
  -o catalog_cts_copper.csv
```

---

## CSV Format Specifications

### Character Encoding
- UTF-8 encoding
- RFC 4180 compliant CSV format

### Special Character Handling
- Fields containing commas, quotes, or newlines are quoted
- Quote characters (") within quoted fields are escaped as ""
- Example: `"Corp, Inc ""Premium"""` represents the value `Corp, Inc "Premium"`

### Data Types
- **Numbers:** Decimal format (e.g., `45.50`, `14418.12`)
- **Dates:** ISO8601 format (e.g., `2026-08-20T09:24:15.103Z`)
- **Null/Empty:** Blank cells (no quote marks)
- **JSON:** Attributes column contains JSON objects (with escaped quotes)

### Column Descriptions

**Quotation Metadata Columns:**
- `Quote Number`: Customer-facing quotation number, or "DRAFT" if not issued
- `Customer`: Customer name
- `Salesman`: Salesman name
- `Status`: "draft" or "issued"
- `Price Category`: Pricing tier used (list, cost, SP, SSP, SR)
- `Created Date`: ISO8601 timestamp when quotation was created
- `Issued Date`: ISO8601 timestamp when quotation was issued, or "NOT ISSUED"
- `Total (before roundoff)`: Sum of all line totals
- `Round Off`: Adjustment amount
- `Grand Total`: Final quoted amount (Total + Round Off)
- `Negotiated Total`: Customer-negotiated amount (if any)

**Line Item Columns:**
- `SKU`: Product SKU/code
- `Item Name`: Product name
- `Brand`: Manufacturer/brand
- `Category`: Product category (normalized UPPERCASE_WITH_UNDERSCORES)
- `UOM`: Unit of measure (Nos, Coil, Drum, etc.)
- `Quantity`: Order quantity
- `Rate`: Unit price
- `Line Total`: Quantity × Rate

**Catalog Columns:**
- `SKU`: Product SKU/code
- `Name`: Product name
- `Brand`: Manufacturer/brand
- `Category`: Product category
- `UOM`: Unit of measure
- `List Price`: Base selling price
- `Popularity`: Sales frequency rank (0-100)
- `Attributes (JSON)`: Structured specifications as JSON (e.g., `{"colour":"white","amps":20}`)

---

## Use Cases

### For KGM Store ERP Integration

1. **Bulk Quotation Import:**
   ```bash
   # Export all quotations to send to KGM ERP
   curl "http://localhost:3000/api/quotations/export/csv?status=issued" \
     -o quotations_for_erp.csv
   # Then upload quotations_for_erp.csv to KGM Store ERP
   ```

2. **Product Catalog Sync:**
   ```bash
   # Export catalog to compare/sync with KGM product master
   curl "http://localhost:3000/api/catalog/export/csv" \
     -o limras_catalog.csv
   # Compare limras_catalog.csv against KGM's product master
   ```

3. **Monthly Reporting:**
   ```bash
   # Export quotations from previous month
   curl "http://localhost:3000/api/quotations/export/csv?startDate=2026-08-01&endDate=2026-08-31" \
     -o quotations_august_2026.csv
   ```

4. **Category-Specific Export:**
   ```bash
   # Export only switches for inventory reconciliation
   curl "http://localhost:3000/api/catalog/export/csv?category=SWITCH_20A" \
     -o switches_catalog.csv
   ```

---

## Error Handling

**404 Not Found:** Quotation doesn't exist
```bash
curl "http://localhost:3000/api/quotations/9999/export/csv"
# Returns: {"error":"Quotation not found."}
```

**404 No Results:** Filter returned no matches
```bash
curl "http://localhost:3000/api/quotations/export/csv?status=draft"
# Returns: {"error":"No quotations found matching the filter."}
```

**500 Server Error:** Unexpected error
```json
{"error":"Error message describing what went wrong"}
```

---

## Integration with KGM Store ERP

### Data Mapping

**Quotation to KGM:**
- Quotation Number → Document Number / Order Number
- Customer → Customer Name
- Line Items → Order Line Items
- Rate × Quantity → Line Amount

**Product Catalog to KGM:**
- SKU → Product Code
- Name → Product Name
- Brand → Manufacturer
- Category → Product Category
- List Price → Base Price / Cost
- Attributes → Custom Fields (as JSON)

### Next Steps

1. **Get KGM's Import Specification:**
   - Required fields
   - Field formats and data types
   - Expected file structure
   - Unique identifiers (SKU matching strategy)

2. **Test Import:**
   - Export a single quotation as CSV
   - Manually import into KGM to verify format
   - Adjust field mapping as needed

3. **Build Import Endpoint:**
   - Create reverse import endpoint: `POST /api/quotations/import`
   - Map KGM fields to Limras schema
   - Handle validation and error cases

---

## Performance Notes

- Single quotation export: ~10-50ms
- Bulk export (200 quotations): ~100-500ms
- Catalog export (227 SKUs): ~50-150ms
- File sizes: ~2-5KB per quotation, ~100KB for full catalog

---

## Version History

- **v1.0** (2026-09-12): Initial release
  - Single quotation export
  - Bulk quotation export with filters
  - Catalog export with category filtering
  - RFC 4180 CSV format with proper escaping

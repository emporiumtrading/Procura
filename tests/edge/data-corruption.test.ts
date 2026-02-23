import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dataCorruptionTesting } from '../mocks/data-corruption.mock';

describe('Data Corruption Testing - Data Integrity Protection', () => {
  let mockDatabase: any;
  let mockRedis: any;
  let mockFileSystem: any;
  let mockChecksum: any;
  let mockExternalApi: any;

  beforeEach(() => {
    mockDatabase = dataCorruptionTesting.mockDatabase();
    mockRedis = dataCorruptionTesting.mockRedis();
    mockFileSystem = dataCorruptionTesting.mockFileSystem();
    mockChecksum = dataCorruptionTesting.mockChecksum();
    mockExternalApi = dataCorruptionTesting.mockExternalApi();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -------------------------------------------------------
  // Partial Database Writes
  // -------------------------------------------------------

  describe('Partial Database Writes', () => {
    it('detects incomplete database transactions', async () => {
      // Mock database transaction that fails partway through
      let transactionState = 'active';
      
      mockDatabase.beginTransaction.mockImplementation(async () => {
        transactionState = 'active';
        return { transactionId: 'tx-123' };
      });

      mockDatabase.insertOpportunity.mockImplementation(async (opportunity: any) => {
        if (transactionState === 'active') {
          // Simulate partial failure on 5th insert
          if (mockDatabase.insertOpportunity.mock.calls.length >= 5) {
            transactionState = 'failed';
            throw new Error('Database connection lost');
          }
          return { id: `opp-${opportunity.external_ref}`, ...opportunity };
        }
        throw new Error('Transaction not active');
      });

      mockDatabase.rollbackTransaction.mockImplementation(async (txId: string) => {
        transactionState = 'rolled_back';
        return true;
      });

      mockDatabase.commitTransaction.mockImplementation(async (txId: string) => {
        if (transactionState === 'active') {
          transactionState = 'committed';
          return true;
        }
        throw new Error('Transaction failed');
      });

      try {
        const result = await dataCorruptionTesting.processBatchWithTransaction([
          { external_ref: 'SAM-1', title: 'Opportunity 1' },
          { external_ref: 'SAM-2', title: 'Opportunity 2' },
          { external_ref: 'SAM-3', title: 'Opportunity 3' },
          { external_ref: 'SAM-4', title: 'Opportunity 4' },
          { external_ref: 'SAM-5', title: 'Opportunity 5' }, // This will fail
          { external_ref: 'SAM-6', title: 'Opportunity 6' }
        ]);
        
        // Should not reach here - transaction should fail
        expect(false).toBe(true);
      } catch (error) {
        // Verify transaction was rolled back
        expect(transactionState).toBe('rolled_back');
        expect(mockDatabase.rollbackTransaction).toHaveBeenCalled();
        expect(mockDatabase.commitTransaction).not.toHaveBeenCalled();
        
        // Verify no partial data was committed
        expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(5); // Failed on 5th
        expect(mockDatabase.getOpportunityByExternalRef).not.toHaveBeenCalledWith('SAM-6');
      }
    });

    it('handles database connection loss during bulk insert', async () => {
      // Mock bulk insert that fails after some records
      let insertedCount = 0;
      
      mockDatabase.bulkInsertOpportunities.mockImplementation(async (opportunities: any[]) => {
        // Simulate connection loss after 3 records
        if (insertedCount < 3) {
          insertedCount += opportunities.length;
          return opportunities.length;
        }
        throw new Error('Database connection lost');
      });

      try {
        const result = await dataCorruptionTesting.bulkInsertWithRetry([
          { external_ref: 'SAM-1', title: 'Opportunity 1' },
          { external_ref: 'SAM-2', title: 'Opportunity 2' },
          { external_ref: 'SAM-3', title: 'Opportunity 3' },
          { external_ref: 'SAM-4', title: 'Opportunity 4' },
          { external_ref: 'SAM-5', title: 'Opportunity 5' }
        ]);
        
        expect(false).toBe(true); // Should fail
      } catch (error) {
        // Verify partial insertion was detected
        expect(insertedCount).toBeGreaterThan(0);
        expect(insertedCount).toBeLessThan(5);
        
        // Verify cleanup was attempted
        expect(mockDatabase.cleanupPartialInserts).toHaveBeenCalled();
      }
    });

    it('detects inconsistent data after partial write', async () => {
      // Mock scenario where some records are inserted but others fail
      mockDatabase.insertOpportunity.mockImplementation(async (opportunity: any) => {
        // Simulate success for first 3, failure for others
        if (opportunity.external_ref.includes('SAM-1') || 
            opportunity.external_ref.includes('SAM-2') || 
            opportunity.external_ref.includes('SAM-3')) {
          return { id: `opp-${opportunity.external_ref}`, ...opportunity };
        }
        throw new Error('Insert failed');
      });

      try {
        const result = await dataCorruptionTesting.processBatchWithVerification([
          { external_ref: 'SAM-1', title: 'Opportunity 1' },
          { external_ref: 'SAM-2', title: 'Opportunity 2' },
          { external_ref: 'SAM-3', title: 'Opportunity 3' },
          { external_ref: 'SAM-4', title: 'Opportunity 4' }, // This will fail
          { external_ref: 'SAM-5', title: 'Opportunity 5' }
        ]);
        
        expect(false).toBe(true); // Should fail
      } catch (error) {
        // Verify inconsistency detection
        expect(mockDatabase.verifyDataConsistency).toHaveBeenCalled();
        expect(mockDatabase.cleanupInconsistentData).toHaveBeenCalled();
      }
    });
  });

  // -------------------------------------------------------
  // Concurrent Update Conflicts
  // -------------------------------------------------------

  describe('Concurrent Update Conflicts', () => {
    it('detects and resolves optimistic locking conflicts', async () => {
      // Mock opportunity with version numbers for optimistic locking
      const opportunity = {
        id: 'opp-001',
        external_ref: 'SAM-001',
        title: 'Opportunity',
        agency: 'DoD',
        version: 1,
        updated_at: new Date().toISOString()
      };

      // Mock initial read
      mockDatabase.getOpportunityById.mockResolvedValue(opportunity);

      // Simulate two concurrent updates
      const update1 = { title: 'Updated Title 1', version: 2 };
      const update2 = { title: 'Updated Title 2', version: 2 };

      // Mock first update succeeds
      mockDatabase.updateOpportunity.mockImplementation(async (id: string, updates: any) => {
        const existing = await mockDatabase.getOpportunityById(id);
        if (existing.version !== updates.version - 1) {
          throw new Error('Version conflict');
        }
        return { ...existing, ...updates, updated_at: new Date().toISOString() };
      });

      // Simulate concurrent update attempts
      const promises = [
        dataCorruptionTesting.updateOpportunityConcurrently('opp-001', update1),
        dataCorruptionTesting.updateOpportunityConcurrently('opp-001', update2)
      ];

      const results = await Promise.allSettled(promises);

      // One should succeed, one should fail with version conflict
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      
      // Verify version conflict was detected
      expect(mockDatabase.handleVersionConflict).toHaveBeenCalled();
      
      // Verify conflict resolution
      const finalOpportunity = await mockDatabase.getOpportunityById('opp-001');
      expect(finalOpportunity.version).toBe(2);
      expect(['Updated Title 1', 'Updated Title 2']).toContain(finalOpportunity.title);
    });

    it('handles race conditions in bulk updates', async () => {
      // Mock scenario with concurrent bulk updates
      const opportunities = [
        { id: 'opp-001', external_ref: 'SAM-001', title: 'Opportunity 1', version: 1 },
        { id: 'opp-002', external_ref: 'SAM-002', title: 'Opportunity 2', version: 1 }
      ];

      // Mock concurrent bulk updates
      const updatePromises = [
        dataCorruptionTesting.bulkUpdateOpportunities(opportunities, { status: 'updated' }),
        dataCorruptionTesting.bulkUpdateOpportunities(opportunities, { status: 'processing' })
      ];

      const results = await Promise.allSettled(updatePromises);

      // Verify conflict detection
      expect(results.filter(r => r.status === 'fulfilled').length).toBeGreaterThan(0);
      expect(results.filter(r => r.status === 'rejected').length).toBeGreaterThan(0);
      
      // Verify final state is consistent
      const finalOpp1 = await mockDatabase.getOpportunityById('opp-001');
      const finalOpp2 = await mockDatabase.getOpportunityById('opp-002');
      
      // At least one should have been updated
      expect([finalOpp1.status, finalOpp2.status]).toContain('updated');
      expect([finalOpp1.status, finalOpp2.status]).toContain('processing');
    });

    it('detects lost updates in concurrent operations', async () => {
      // Mock scenario where one update overwrites another
      const opportunity = {
        id: 'opp-001',
        external_ref: 'SAM-001',
        title: 'Original Title',
        agency: 'DoD',
        updated_at: new Date(Date.now() - 60000).toISOString() // 1 minute ago
      };

      // Mock read with stale data
      mockDatabase.getOpportunityById.mockResolvedValue(opportunity);

      // Simulate first update
      await dataCorruptionTesting.updateOpportunity('opp-001', { title: 'First Update' });

      // Simulate second update with stale data
      const secondUpdatePromise = dataCorruptionTesting.updateOpportunity('opp-001', { 
        title: 'Second Update',
        updated_at: opportunity.updated_at // Using stale timestamp
      });

      try {
        await secondUpdatePromise;
        expect(false).toBe(true); // Should fail due to stale data
      } catch (error) {
        // Verify lost update was detected
        expect(mockDatabase.detectLostUpdate).toHaveBeenCalled();
        
        // Verify conflict resolution was attempted
        expect(mockDatabase.resolveLostUpdate).toHaveBeenCalled();
      }
    });
  });

  // -------------------------------------------------------
  // Schema Drift Detection
  // -------------------------------------------------------

  describe('Schema Drift Detection', () => {
    it('detects database schema changes', async () => {
      // Mock current schema
      const currentSchema = {
        opportunities: {
          columns: ['id', 'external_ref', 'title', 'agency', 'source', 'fit_score'],
          version: '1.0.0'
        }
      };

      // Mock schema validation
      mockDatabase.getDatabaseSchema.mockResolvedValue(currentSchema);

      // Simulate schema drift
      const driftedSchema = {
        opportunities: {
          columns: ['id', 'external_ref', 'title', 'agency', 'source', 'fit_score', 'new_column'],
          version: '1.0.1'
        }
      };

      mockDatabase.getActualDatabaseSchema.mockResolvedValue(driftedSchema);

      // Run schema validation
      const result = await dataCorruptionTesting.validateDatabaseSchema();
      
      expect(result).toEqual({
        valid: false,
        discrepancies: [
          { table: 'opportunities', type: 'column_added', column: 'new_column' },
          { table: 'opportunities', type: 'version_mismatch', expected: '1.0.0', actual: '1.0.1' }
        ]
      });
      
      // Verify drift detection was triggered
      expect(mockDatabase.detectSchemaDrift).toHaveBeenCalled();
      
      // Verify alert was sent
      expect(mockDatabase.sendSchemaDriftAlert).toHaveBeenCalled();
    });

    it('handles API response schema changes', async () => {
      // Mock API client with schema validation
      const expectedSchema = {
        opportunities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              agency: { type: 'string' },
              fit_score: { type: 'number' }
            }
          }
        }
      };

      // Mock actual API response with schema drift
      const driftedResponse = {
        opportunities: [
          {
            id: 'opp-001',
            title: 'Opportunity',
            agency: 'DoD',
            fit_score: 85,
            new_field: 'unexpected' // Schema drift
          }
        ]
      };

      mockExternalApi.getOpportunities.mockResolvedValue(driftedResponse);

      try {
        const result = await dataCorruptionTesting.fetchAndValidateOpportunities();
        
        // Should detect schema drift
        expect(result).toEqual({
          success: false,
          error: 'Schema drift detected: unexpected field "new_field"'
        });
        
        expect(mockDatabase.logSchemaDrift).toHaveBeenCalled();
      } catch (error) {
        // Should handle schema drift gracefully
        expect(error.message).toContain('Schema drift');
      }
    });

    it('maintains backward compatibility during schema changes', async () => {
      // Mock old schema
      const oldSchema = {
        opportunities: {
          columns: ['id', 'external_ref', 'title', 'agency', 'source'],
          version: '1.0.0'
        }
      };

      // Mock new schema with additional fields
      const newSchema = {
        opportunities: {
          columns: ['id', 'external_ref', 'title', 'agency', 'source', 'fit_score', 'effort_score'],
          version: '1.0.1'
        }
      };

      // Mock database with both schemas
      mockDatabase.getDatabaseSchema.mockResolvedValue(oldSchema);
      mockDatabase.getActualDatabaseSchema.mockResolvedValue(newSchema);

      // Mock data migration
      mockDatabase.migrateSchema.mockImplementation(async (from: string, to: string) => {
        // Simulate migration
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      });

      // Test backward compatibility
      const result = await dataCorruptionTesting.handleSchemaMigration('1.0.0', '1.0.1');
      
      expect(result).toEqual({
        success: true,
        migrated: true,
        from_version: '1.0.0',
        to_version: '1.0.1'
      });
      
      // Verify data integrity after migration
      expect(mockDatabase.verifyDataIntegrity).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // Data Validation Failures
  // -------------------------------------------------------

  describe('Data Validation Failures', () => {
    it('detects invalid data formats', async () => {
      // Mock opportunity with invalid data
      const invalidOpportunity = {
        external_ref: 'SAM-001',
        title: 'Opportunity',
        agency: 'DoD',
        fit_score: 'invalid-score', // Should be number
        posted_date: 'invalid-date', // Invalid date format
        estimated_value: 'invalid-amount' // Should be number
      };

      // Mock validation
      mockDatabase.validateOpportunity.mockImplementation((opportunity: any) => {
        const errors = [];
        
        if (typeof opportunity.fit_score !== 'number') {
          errors.push('fit_score must be a number');
        }
        
        if (isNaN(Date.parse(opportunity.posted_date))) {
          errors.push('posted_date must be a valid date');
        }
        
        if (typeof opportunity.estimated_value !== 'number') {
          errors.push('estimated_value must be a number');
        }
        
        return { valid: errors.length === 0, errors };
      });

      const validationResult = await dataCorruptionTesting.validateOpportunityData(invalidOpportunity);
      
      expect(validationResult).toEqual({
        valid: false,
        errors: [
          'fit_score must be a number',
          'posted_date must be a valid date', 
          'estimated_value must be a number'
        ]
      });
      
      // Verify invalid data was rejected
      expect(mockDatabase.rejectInvalidData).toHaveBeenCalled();
    });

    it('detects duplicate data with different formats', async () => {
      // Mock duplicate opportunities with different formats
      const opportunity1 = {
        external_ref: 'SAM-001',
        title: 'Opportunity',
        agency: 'DoD',
        fit_score: 85,
        posted_date: '2025-01-15'
      };

      const opportunity2 = {
        external_ref: 'SAM-001',
        title: 'Opportunity',
        agency: 'Department of Defense',
        fit_score: '85', // String instead of number
        posted_date: '01/15/2025' // Different date format
      };

      // Mock duplicate detection with format validation
      mockDatabase.detectDuplicates.mockImplementation(async (opp1: any, opp2: any) => {
        const areDuplicates = opp1.external_ref === opp2.external_ref;
        const formatIssues = [];
        
        if (typeof opp2.fit_score !== 'number') {
          formatIssues.push('fit_score format mismatch');
        }
        
        if (isNaN(Date.parse(opp2.posted_date))) {
          formatIssues.push('posted_date format mismatch');
        }
        
        return { areDuplicates, formatIssues };
      });

      const duplicateResult = await dataCorruptionTesting.detectAndHandleDuplicates(opportunity1, opportunity2);
      
      expect(duplicateResult).toEqual({
        are_duplicates: true,
        format_issues: ['fit_score format mismatch', 'posted_date format mismatch']
      });
      
      // Verify format normalization was attempted
      expect(mockDatabase.normalizeDataFormats).toHaveBeenCalled();
    });

    it('detects inconsistent data across systems', async () => {
      // Mock opportunity data in different systems
      const databaseOpportunity = {
        id: 'opp-001',
        external_ref: 'SAM-001',
        title: 'Opportunity',
        agency: 'DoD',
        fit_score: 85,
        updated_at: new Date(Date.now() - 1000).toISOString()
      };

      const apiOpportunity = {
        id: 'opp-001',
        external_ref: 'SAM-001',
        title: 'Opportunity',
        agency: 'Department of Defense',
        fit_score: 90, // Different score
        updated_at: new Date(Date.now()).toISOString() // More recent
      };

      // Mock data comparison
      mockDatabase.compareOpportunityData.mockImplementation((db: any, api: any) => {
        const discrepancies = [];
        
        if (db.fit_score !== api.fit_score) {
          discrepancies.push({ field: 'fit_score', db_value: db.fit_score, api_value: api.fit_score });
        }
        
        if (db.agency !== api.agency) {
          discrepancies.push({ field: 'agency', db_value: db.agency, api_value: api.agency });
        }
        
        const dbIsStale = new Date(db.updated_at) < new Date(api.updated_at);
        
        return { discrepancies, dbIsStale };
      });

      const comparisonResult = await dataCorruptionTesting.compareDataAcrossSystems(
        databaseOpportunity,
        apiOpportunity
      );
      
      expect(comparisonResult).toEqual({
        discrepancies: [
          { field: 'fit_score', db_value: 85, api_value: 90 },
          { field: 'agency', db_value: 'DoD', api_value: 'Department of Defense' }
        ],
        db_is_stale: true
      });
      
      // Verify conflict resolution was attempted
      expect(mockDatabase.resolveDataConflict).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // Checksum Verification
  // -------------------------------------------------------

  describe('Checksum Verification', () => {
    it('detects data corruption using checksums', async () => {
      // Mock opportunity data
      const originalOpportunity = {
        id: 'opp-001',
        external_ref: 'SAM-001',
        title: 'Opportunity',
        agency: 'DoD',
        fit_score: 85,
        description: 'Important opportunity details'
      };

      // Mock checksum calculation
      mockChecksum.calculateChecksum.mockImplementation((data: any) => {
        // Simple checksum based on stringified data
        return JSON.stringify(data);
      });

      // Calculate original checksum
      const originalChecksum = await dataCorruptionTesting.calculateChecksum(originalOpportunity);
      
      // Simulate data corruption
      const corruptedOpportunity = {
        ...originalOpportunity,
        description: 'Corrupted opportunity details' // Data changed
      };

      const corruptedChecksum = await dataCorruptionTesting.calculateChecksum(corruptedOpportunity);
      
      // Verify checksums are different
      expect(originalChecksum).not.toBe(corruptedChecksum);
      
      // Verify corruption detection
      const corruptionDetected = await dataCorruptionTesting.detectCorruption(
        originalOpportunity,
        corruptedOpportunity
      );
      
      expect(corruptionDetected).toBe(true);
      
      // Verify corrupted data was rejected
      expect(mockDatabase.rejectCorruptedData).toHaveBeenCalled();
    });

    it('verifies data integrity during transfers', async () => {
      // Mock data transfer scenario
      const originalData = {
        opportunities: [
          { id: 'opp-001', title: 'Opportunity 1', agency: 'DoD', fit_score: 85 },
          { id: 'opp-002', title: 'Opportunity 2', agency: 'DHS', fit_score: 75 }
        ],
        metadata: { total: 2, page: 1, limit: 10 }
      };

      // Calculate checksum before transfer
      const preTransferChecksum = await dataCorruptionTesting.calculateChecksum(originalData);
      
      // Simulate data transfer with potential corruption
      let transferredData = JSON.parse(JSON.stringify(originalData));
      
      // Simulate corruption in transit (randomly change one field)
      if (Math.random() > 0.5) {
        transferredData.opportunities[0].title = 'Corrupted Title';
      }

      // Calculate checksum after transfer
      const postTransferChecksum = await dataCorruptionTesting.calculateChecksum(transferredData);
      
      // Verify integrity
      const isIntact = await dataCorruptionTesting.verifyDataIntegrity(
        originalData,
        transferredData,
        preTransferChecksum,
        postTransferChecksum
      );
      
      if (preTransferChecksum !== postTransferChecksum) {
        expect(isIntact).toBe(false);
        expect(mockDatabase.handleDataCorruption).toHaveBeenCalled();
      } else {
        expect(isIntact).toBe(true);
      }
    });

    it('maintains checksum history for audit trail', async () => {
      // Mock historical checksum tracking
      const opportunityHistory = [
        {
          opportunity: { id: 'opp-001', title: 'Original Title', agency: 'DoD', fit_score: 85 },
          checksum: 'original-checksum',
          timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        },
        {
          opportunity: { id: 'opp-001', title: 'Updated Title', agency: 'DoD', fit_score: 90 },
          checksum: 'updated-checksum',
          timestamp: new Date(Date.now() - 1800000).toISOString() // 30 minutes ago
        }
      ];

      // Mock current state
      const currentOpportunity = {
        id: 'opp-001',
        title: 'Current Title',
        agency: 'DoD',
        fit_score: 88
      };

      // Mock checksum verification against history
      mockChecksum.verifyAgainstHistory.mockImplementation(async (
        current: any, 
        history: any[],
        threshold: number
      ) => {
        const currentChecksum = await dataCorruptionTesting.calculateChecksum(current);
        const recentHistory = history.filter(h => 
          new Date() - new Date(h.timestamp) < threshold
        );
        
        const matches = recentHistory.some(h => 
          h.checksum === currentChecksum
        );
        
        return { matches, closest_match: recentHistory[0] };
      });

      const verificationResult = await dataCorruptionTesting.verifyWithChecksumHistory(
        currentOpportunity,
        opportunityHistory,
        7200000 // 2 hours
      );
      
      expect(verificationResult).toEqual({
        matches: false, // Current doesn't match recent history
        closest_match: opportunityHistory[1] // Closest to recent update
      });
      
      // Verify audit trail was updated
      expect(mockDatabase.updateAuditTrail).toHaveBeenCalled();
    });
  });

  // Meta-cognitive debug protocol tags used:
  // [DATA_CORRUPTION] - Data integrity and corruption detection
  // [EXTERNAL_DEPENDENCY] - Database and file system mocking
  // [ASYNC_TIMING] - Transaction timing and rollback
  // [RACE_CONDITION] - Concurrent update handling
});
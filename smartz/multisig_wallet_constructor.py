
import re

from smartz.api.constructor_engine import ConstructorInstance


class Constructor(ConstructorInstance):

    MAX_OWNERS = 250

    def get_version(self):
        return {
            "result": "success",
            "version": 1
        }

    def get_params(self):
        json_schema = {
            "type": "object",
            "required": ["signs_count", "owners"],
            "additionalProperties": False,

            "properties": {
                "signs_count": {
                    "type": "integer",
                    "minimum": 1,
                    "default": 2,
                    "maximum": self.__class__.MAX_OWNERS,
                    "title": "Signatures quorum",
                    "description": "Number of signatures required to withdraw funds or modify signatures"
                },

                "owners": {
                    "title": "Addresses of owners",
                    "description": "Addresses (signatures) of owners of a new wallet",
                    "type": "array",
                    "items": {"$ref": "#/definitions/address"},
                    "minItems": 1,
                    "maxItems": self.__class__.MAX_OWNERS
                },

                "thaw_ts": {
                    "title": "Thaw time",
                    "description": "Until that time any funds or tokens which is held by this contract will be frozen "
                                   "- no one will be able to transfer it.",
                    "$ref": "#/definitions/unixTime",
                }
            }
        }

        ui_schema = {
            "signs_count": {
                "ui:widget": "updown",
            },
            "owners": {
                "items": {
                    "ui:placeholder": "Valid Ethereum address"
                },
                "ui:options": {
                    "orderable": False
                }
            },
            "thaw_ts": {
                "ui:widget": "unixTime"
            }
        }

        return {
            "result": "success",
            'schema': json_schema,
            'ui_schema': ui_schema
        }

    def construct(self, fields):
        errors = {}

        if fields['signs_count'] > len(fields['owners']):
            errors["signs_count"] = 'Signatures quorum is greater than total number of owners'

        if errors:
            return {
                "result": "error",
                "errors": errors
            }

        def safe_replace(string, from_, to_):
            result = string.replace(from_, to_)
            if result == string:
                raise AssertionError('failed to replace: {}'.format(from_))
            return result

        owners_code = 'address[] memory result = new address[]({});\n'.format(len(fields['owners']))
        owners_code += '\n'.join(
            'result[{}] = address({});'.format(idx, owner) for (idx, owner) in enumerate(fields['owners'])
        )

        source = safe_replace(self.__class__._TEMPLATE, '%owners_code%', owners_code)
        source = safe_replace(source, '%signs_count%', str(fields['signs_count']))
        source = safe_replace(source, '%thaw_ts%', str(fields.get('thaw_ts', 0)))

        # final checks

        for match in re.findall(r'%([a-zA-Z_0-9]+)%', source):
            if match != 'payment_code':
                raise AssertionError('not substituted: {}'.format(match))

        return {
            'result': "success",
            'source': source,
            'contract_name': "MultiSigWallet"
        }

    def post_construct(self, fields, abi_array):

        function_specs = {
            'm_numOwners': {
                'title': 'Number of owners',
                'description': 'How many owners are added to the contract',
            },

            'changeRequirement': {
                'title': 'Change quorum requirement',
                'description': 'Change number of signatures required to perform actions on this wallet '
                               '(withdraw money, change owners, etc). Quorum of wallet owners must call this function with the same parameters for this action to happen.',
                'inputs': [{
                    'title': 'new requirement',
                    'description': 'new number of signatures required to perform actions on this wallet'
                }]
            },

            'sendEther': {
                'title': 'Send Ether',
                'description': 'Send some amount of Ether from this wallet to specified address. Quorum of wallet owners must call this function with the same parameters for this action to happen.',
                'inputs': [{
                    'title': 'Destination address',
                }, {
                    'title': 'Amount in wei',
                    'description': 'Amount must be specified in the smallest units: wei (1 Ether is 1000000000000000000 wei).'
                }]
            },

            'sendTokens': {
                'title': 'Send tokens',
                'description': 'Send some amount of tokens',
                'inputs': [{
                    'title': 'Token smart contract address',
                },{
                    'title': 'Destination address',
                }, {
                    'title': 'Amount in token wei',
                    'description': 'Amount must be specified in the smallest units: token wei'
                }]
            },

            'tokenBalance': {
                'title': 'Get token balance',
                'description': 'Token balance in token wei',
                'inputs': [{
                    'title': 'Token smart contract address',
                }]
            },

            'm_multiOwnedRequired': {
                'title': 'Quorum requirement',
                'description': 'Number of signatures required to perform actions on this wallet',
            },

            'hasConfirmed': {
                'title': 'Is operation confirmed?',
                'description': 'Checks if operation confirmed by an owner.',
            },

            'revoke': {
                'title': 'Revoke confirmation',
                'description': 'Revoke confirmation of current owner (current account) from operation.',
            },

            'amIOwner': {
                'title': 'Am I owner?',
                'description': 'Checks if current account is one of the wallet owners.',
            },

            'isOwner': {
                'title': 'Check owner',
                'description': 'Checks if specified account is one of the wallet owners.',
                'inputs': [{
                    'title': 'Address to check',
                }]
            },

            'getOwners': {
                'title': 'Owners',
                'description': 'Returns list of all current owners of the wallet.',
            },

            'getOwner': {
                'title': 'Get n-th owner',
                'description': 'Returns n-th owner',
                'inputs': [{
                    'title': 'Owner\'s number',
                    'description': 'Owner\'s number, starting from zero.',
                }]
            },

            'removeOwner': {
                'title': 'Remove owner',
                'description': 'Removes specified owner. Quorum of wallet owners must call this function with the same parameters for this action to happen.',
                'inputs': [{
                    'title': 'Address',
                    'description': 'Address of the owner to remove.',
                }]
            },

            'addOwner': {
                'title': 'Add owner',
                'description': 'Adds a new owner. Quorum of wallet owners must call this function with the same parameters for this action to happen.',
                'inputs': [{
                    'title': 'Address',
                    'description': 'Address of the new (additional) owner.',
                }]
            },

            'changeOwner': {
                'title': 'Change owner',
                'description': 'Changes address of existing owner from one to another. Quorum of wallet owners must call this function with the same parameters for this action to happen.',
                'inputs': [{
                    'title': 'Old address',
                }, {
                    'title': 'New address',
                }]
            },

            'frozenUntil': {
                'title': 'Thaw time',
                'description': "Until that time any funds or tokens which is held by this contract will be frozen "
                               "- no one will be able to transfer it.",
                'ui:widget': 'unixTime',
                'ui:widget_options': {
                    'format': "yyyy.mm.dd HH:MM:ss (o)"
                },
            }
        }

        return {
            "result": "success",
            'function_specs': function_specs,
            'dashboard_functions': ['m_numOwners', 'm_multiOwnedRequired']
        }


    # language=Solidity
    _TEMPLATE = """
// Copyright (C) 2017-2018  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

// Code taken from https://github.com/ethereum/dapp-bin/blob/master/wallet/wallet.sol
// Audit, refactoring and improvements by github.com/Eenae

// @authors:
// Gav Wood <g@ethdev.com>
// inheritable "property" contract that enables methods to be protected by requiring the acquiescence of either a
// single, or, crucially, each of a number of, designated owners.
// usage:
// use modifiers onlyowner (just own owned) or onlymanyowners(hash), whereby the same hash must be provided by
// some number (specified in constructor) of the set of owners (specified in the constructor, modifiable) before the
// interior is executed.

pragma solidity ^0.4.15;

contract multiowned {

	// TYPES

    // struct for the status of a pending operation.
    struct MultiOwnedOperationPendingState {
        // count of confirmations needed
        uint yetNeeded;

        // bitmap of confirmations where owner #ownerIndex's decision corresponds to 2**ownerIndex bit
        uint ownersDone;

        // position of this operation key in m_multiOwnedPendingIndex
        uint index;
    }

	// EVENTS

    event Confirmation(address owner, bytes32 operation);
    event Revoke(address owner, bytes32 operation);
    event FinalConfirmation(address owner, bytes32 operation);

    // some others are in the case of an owner changing.
    event OwnerChanged(address oldOwner, address newOwner);
    event OwnerAdded(address newOwner);
    event OwnerRemoved(address oldOwner);

    // the last one is emitted if the required signatures change
    event RequirementChanged(uint newRequirement);

	// MODIFIERS

    // simple single-sig function modifier.
    modifier onlyowner {
        require(isOwner(msg.sender));
        _;
    }
    // multi-sig function modifier: the operation must have an intrinsic hash in order
    // that later attempts can be realised as the same underlying operation and
    // thus count as confirmations.
    modifier onlymanyowners(bytes32 _operation) {
        if (confirmAndCheck(_operation)) {
            _;
        }
        // Even if required number of confirmations has't been collected yet,
        // we can't throw here - because changes to the state have to be preserved.
        // But, confirmAndCheck itself will throw in case sender is not an owner.
    }

    modifier validNumOwners(uint _numOwners) {
        require(_numOwners > 0 && _numOwners <= c_maxOwners);
        _;
    }

    modifier multiOwnedValidRequirement(uint _required, uint _numOwners) {
        require(_required > 0 && _required <= _numOwners);
        _;
    }

    modifier ownerExists(address _address) {
        require(isOwner(_address));
        _;
    }

    modifier ownerDoesNotExist(address _address) {
        require(!isOwner(_address));
        _;
    }

    modifier multiOwnedOperationIsActive(bytes32 _operation) {
        require(isOperationActive(_operation));
        _;
    }

	// METHODS

    // constructor is given number of sigs required to do protected "onlymanyowners" transactions
    // as well as the selection of addresses capable of confirming them (msg.sender is not added to the owners!).
    function multiowned(address[] _owners, uint _required)
        public
        validNumOwners(_owners.length)
        multiOwnedValidRequirement(_required, _owners.length)
    {
        assert(c_maxOwners <= 255);

        m_numOwners = _owners.length;
        m_multiOwnedRequired = _required;

        for (uint i = 0; i < _owners.length; ++i)
        {
            address owner = _owners[i];
            // invalid and duplicate addresses are not allowed
            require(0 != owner && !isOwner(owner) /* not isOwner yet! */);

            uint currentOwnerIndex = checkOwnerIndex(i + 1 /* first slot is unused */);
            m_owners[currentOwnerIndex] = owner;
            m_ownerIndex[owner] = currentOwnerIndex;
        }

        assertOwnersAreConsistent();
    }

    /// @notice replaces an owner `_from` with another `_to`.
    /// @param _from address of owner to replace
    /// @param _to address of new owner
    // All pending operations will be canceled!
    function changeOwner(address _from, address _to)
        external
        ownerExists(_from)
        ownerDoesNotExist(_to)
        onlymanyowners(keccak256(msg.data))
    {
        assertOwnersAreConsistent();

        clearPending();
        uint ownerIndex = checkOwnerIndex(m_ownerIndex[_from]);
        m_owners[ownerIndex] = _to;
        m_ownerIndex[_from] = 0;
        m_ownerIndex[_to] = ownerIndex;

        assertOwnersAreConsistent();
        OwnerChanged(_from, _to);
    }

    /// @notice adds an owner
    /// @param _owner address of new owner
    // All pending operations will be canceled!
    function addOwner(address _owner)
        external
        ownerDoesNotExist(_owner)
        validNumOwners(m_numOwners + 1)
        onlymanyowners(keccak256(msg.data))
    {
        assertOwnersAreConsistent();

        clearPending();
        m_numOwners++;
        m_owners[m_numOwners] = _owner;
        m_ownerIndex[_owner] = checkOwnerIndex(m_numOwners);

        assertOwnersAreConsistent();
        OwnerAdded(_owner);
    }

    /// @notice removes an owner
    /// @param _owner address of owner to remove
    // All pending operations will be canceled!
    function removeOwner(address _owner)
        external
        ownerExists(_owner)
        validNumOwners(m_numOwners - 1)
        multiOwnedValidRequirement(m_multiOwnedRequired, m_numOwners - 1)
        onlymanyowners(keccak256(msg.data))
    {
        assertOwnersAreConsistent();

        clearPending();
        uint ownerIndex = checkOwnerIndex(m_ownerIndex[_owner]);
        m_owners[ownerIndex] = 0;
        m_ownerIndex[_owner] = 0;
        //make sure m_numOwners is equal to the number of owners and always points to the last owner
        reorganizeOwners();

        assertOwnersAreConsistent();
        OwnerRemoved(_owner);
    }

    /// @notice changes the required number of owner signatures
    /// @param _newRequired new number of signatures required
    // All pending operations will be canceled!
    function changeRequirement(uint _newRequired)
        external
        multiOwnedValidRequirement(_newRequired, m_numOwners)
        onlymanyowners(keccak256(msg.data))
    {
        m_multiOwnedRequired = _newRequired;
        clearPending();
        RequirementChanged(_newRequired);
    }

    /// @notice Gets an owner by 0-indexed position
    /// @param ownerIndex 0-indexed owner position
    function getOwner(uint ownerIndex) public constant returns (address) {
        return m_owners[ownerIndex + 1];
    }

    /// @notice Gets owners
    /// @return memory array of owners
    function getOwners() public constant returns (address[]) {
        address[] memory result = new address[](m_numOwners);
        for (uint i = 0; i < m_numOwners; i++)
            result[i] = getOwner(i);

        return result;
    }

    /// @notice checks if provided address is an owner address
    /// @param _addr address to check
    /// @return true if it's an owner
    function isOwner(address _addr) public constant returns (bool) {
        return m_ownerIndex[_addr] > 0;
    }

    /// @notice Tests ownership of the current caller.
    /// @return true if it's an owner
    // It's advisable to call it by new owner to make sure that the same erroneous address is not copy-pasted to
    // addOwner/changeOwner and to isOwner.
    function amIOwner() external constant onlyowner returns (bool) {
        return true;
    }

    /// @notice Revokes a prior confirmation of the given operation
    /// @param _operation operation value, typically keccak256(msg.data)
    function revoke(bytes32 _operation)
        external
        multiOwnedOperationIsActive(_operation)
        onlyowner
    {
        uint ownerIndexBit = makeOwnerBitmapBit(msg.sender);
        var pending = m_multiOwnedPending[_operation];
        require(pending.ownersDone & ownerIndexBit > 0);

        assertOperationIsConsistent(_operation);

        pending.yetNeeded++;
        pending.ownersDone -= ownerIndexBit;

        assertOperationIsConsistent(_operation);
        Revoke(msg.sender, _operation);
    }

    /// @notice Checks if owner confirmed given operation
    /// @param _operation operation value, typically keccak256(msg.data)
    /// @param _owner an owner address
    function hasConfirmed(bytes32 _operation, address _owner)
        external
        constant
        multiOwnedOperationIsActive(_operation)
        ownerExists(_owner)
        returns (bool)
    {
        return !(m_multiOwnedPending[_operation].ownersDone & makeOwnerBitmapBit(_owner) == 0);
    }

    // INTERNAL METHODS

    function confirmAndCheck(bytes32 _operation)
        private
        onlyowner
        returns (bool)
    {
        if (512 == m_multiOwnedPendingIndex.length)
            // In case m_multiOwnedPendingIndex grows too much we have to shrink it: otherwise at some point
            // we won't be able to do it because of block gas limit.
            // Yes, pending confirmations will be lost. Dont see any security or stability implications.
            // TODO use more graceful approach like compact or removal of clearPending completely
            clearPending();

        var pending = m_multiOwnedPending[_operation];

        // if we're not yet working on this operation, switch over and reset the confirmation status.
        if (! isOperationActive(_operation)) {
            // reset count of confirmations needed.
            pending.yetNeeded = m_multiOwnedRequired;
            // reset which owners have confirmed (none) - set our bitmap to 0.
            pending.ownersDone = 0;
            pending.index = m_multiOwnedPendingIndex.length++;
            m_multiOwnedPendingIndex[pending.index] = _operation;
            assertOperationIsConsistent(_operation);
        }

        // determine the bit to set for this owner.
        uint ownerIndexBit = makeOwnerBitmapBit(msg.sender);
        // make sure we (the message sender) haven't confirmed this operation previously.
        if (pending.ownersDone & ownerIndexBit == 0) {
            // ok - check if count is enough to go ahead.
            assert(pending.yetNeeded > 0);
            if (pending.yetNeeded == 1) {
                // enough confirmations: reset and run interior.
                delete m_multiOwnedPendingIndex[m_multiOwnedPending[_operation].index];
                delete m_multiOwnedPending[_operation];
                FinalConfirmation(msg.sender, _operation);
                return true;
            }
            else
            {
                // not enough: record that this owner in particular confirmed.
                pending.yetNeeded--;
                pending.ownersDone |= ownerIndexBit;
                assertOperationIsConsistent(_operation);
                Confirmation(msg.sender, _operation);
            }
        }
    }

    // Reclaims free slots between valid owners in m_owners.
    // TODO given that its called after each removal, it could be simplified.
    function reorganizeOwners() private {
        uint free = 1;
        while (free < m_numOwners)
        {
            // iterating to the first free slot from the beginning
            while (free < m_numOwners && m_owners[free] != 0) free++;

            // iterating to the first occupied slot from the end
            while (m_numOwners > 1 && m_owners[m_numOwners] == 0) m_numOwners--;

            // swap, if possible, so free slot is located at the end after the swap
            if (free < m_numOwners && m_owners[m_numOwners] != 0 && m_owners[free] == 0)
            {
                // owners between swapped slots should't be renumbered - that saves a lot of gas
                m_owners[free] = m_owners[m_numOwners];
                m_ownerIndex[m_owners[free]] = free;
                m_owners[m_numOwners] = 0;
            }
        }
    }

    function clearPending() private onlyowner {
        uint length = m_multiOwnedPendingIndex.length;
        // TODO block gas limit
        for (uint i = 0; i < length; ++i) {
            if (m_multiOwnedPendingIndex[i] != 0)
                delete m_multiOwnedPending[m_multiOwnedPendingIndex[i]];
        }
        delete m_multiOwnedPendingIndex;
    }

    function checkOwnerIndex(uint ownerIndex) private pure returns (uint) {
        assert(0 != ownerIndex && ownerIndex <= c_maxOwners);
        return ownerIndex;
    }

    function makeOwnerBitmapBit(address owner) private constant returns (uint) {
        uint ownerIndex = checkOwnerIndex(m_ownerIndex[owner]);
        return 2 ** ownerIndex;
    }

    function isOperationActive(bytes32 _operation) private constant returns (bool) {
        return 0 != m_multiOwnedPending[_operation].yetNeeded;
    }


    function assertOwnersAreConsistent() private constant {
        assert(m_numOwners > 0);
        assert(m_numOwners <= c_maxOwners);
        assert(m_owners[0] == 0);
        assert(0 != m_multiOwnedRequired && m_multiOwnedRequired <= m_numOwners);
    }

    function assertOperationIsConsistent(bytes32 _operation) private constant {
        var pending = m_multiOwnedPending[_operation];
        assert(0 != pending.yetNeeded);
        assert(m_multiOwnedPendingIndex[pending.index] == _operation);
        assert(pending.yetNeeded <= m_multiOwnedRequired);
    }


   	// FIELDS

    uint constant c_maxOwners = 250;

    // the number of owners that must confirm the same operation before it is run.
    uint public m_multiOwnedRequired;


    // pointer used to find a free slot in m_owners
    uint public m_numOwners;

    // list of owners (addresses),
    // slot 0 is unused so there are no owner which index is 0.
    // TODO could we save space at the end of the array for the common case of <10 owners? and should we?
    address[256] internal m_owners;

    // index on the list of owners to allow reverse lookup: owner address => index in m_owners
    mapping(address => uint) internal m_ownerIndex;


    // the ongoing operations.
    mapping(bytes32 => MultiOwnedOperationPendingState) internal m_multiOwnedPending;
    bytes32[] internal m_multiOwnedPendingIndex;
}

contract ERC20Basic {
  uint256 public totalSupply;
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

contract SimpleMultiSigWallet is multiowned {

    event Deposit(address indexed sender, uint value);
    event EtherSent(address indexed to, uint value);

    function SimpleMultiSigWallet(address[] _owners, uint _signaturesRequired)
        public
        multiowned(_owners, _signaturesRequired)
    {
    }

    /// @dev Fallback function allows to deposit ether.
    function()
        public
        payable
    {
        if (msg.value > 0)
            Deposit(msg.sender, msg.value);
    }

    /// @notice Send `value` of ether to address `to`
    /// @param to where to send ether
    /// @param value amount of wei to send
    function sendEther(address to, uint value)
        public
        onlymanyowners(keccak256(msg.data))
    {
        require(address(0) != to);
        require(value > 0 && this.balance >= value);
        to.transfer(value);
        EtherSent(to, value);
    }
}

contract MultiSigWallet is SimpleMultiSigWallet {

    // EVENTS

    event TokensSent(address token, address indexed to, uint value);


    // MODIFIERS

    modifier notFrozen {
        require(getCurrentTime() >= m_thawTs);
        _;
    }


    // PUBLIC FUNCTIONS

    function MultiSigWallet()
        public
        payable
        SimpleMultiSigWallet(getInitialOwners(), %signs_count%)
    {
        m_thawTs = %thaw_ts%;

        %payment_code%
    }

    function getInitialOwners() private pure returns (address[]) {
        %owners_code%
        return result;
    }

    function sendEther(address to, uint value)
        public
        notFrozen
    {
        super.sendEther(to, value);
    }

    function sendTokens(address token, address to, uint value)
        public
        notFrozen
        onlymanyowners(keccak256(msg.data))
        returns (bool)
    {
        require(address(0) != to);
        require(address(0) != token);
        require(token != to);
        require(isContract(token));

        if (ERC20Basic(token).transfer(to, value)) {
            TokensSent(token, to, value);
            return true;
        }

        return false;
    }


    // PUBLIC VIEW FUNCTIONS

    function tokenBalance(address token) public view returns (uint256) {
        return ERC20Basic(token).balanceOf(this);
    }

    function frozenUntil() public view returns (uint) {
        return m_thawTs;
    }


    // INTERNAL FUNCTIONS

    function isContract(address _addr)
        private
        view
        returns (bool hasCode)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function getCurrentTime() internal view returns (uint) {
        return now;
    }


    // FIELDS

    uint private m_thawTs;
}
    """

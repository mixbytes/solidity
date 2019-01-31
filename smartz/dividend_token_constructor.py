from smartz.api.constructor_engine import ConstructorInstance

_DESCRIPTION_ = '''
Contract allows receive payments in ETH and distribute them between divident token holders according to their relative token balances (share amounts). It's simple and useful instrument to organise incoming payments for DAO members. It can also be used to fix DAO member shares an redistribute them with simple transfers.

For example, Alice, Bob and Eva have 500,200 and 300 tokens in contract with total supply of tokens equal 1000 (50%, 20% and 30% respectively). Then, incoming payment of100 ETH will be distributed as dividends to Alice, Bob and Eva as 50, 20 and 30 ETH respectively.
Every incoming payment is distributed accordingly to CURRENT token distribution, and, in case of minting(emission) of new tokens, all shares of all participants will be diluted, and next payment will be distributed accordingly.
For example if Alice mint +1000 tokens on her address, then Alice, Bob and Eva has 1500, 200 and 300 tokens with total emission of 2000 tokens (75%, 10% and 15% respectively). Now next payment of 100ETH will be distributed as 75, 10 and 15 ETH respectively
'''


class Constructor(ConstructorInstance):
    def get_version(self):
        return {
            "result": "success",
            "version": 1
        }

    def get_params(self):
        json_schema = {
            "type": "object",
            "required": [
                "name", "symbol", "decimals",
            ],
            "additionalProperties": False,

            "properties": {
                "name": {
                    "title": "Name of a dividend token",
                    "description": "Dapp name to be displayed in Smartz dashboard.",
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 100,
                    "pattern": "^[a-zA-Z0-9 ]+$"
                },

                "symbol": {
                    "title": "Token Symbol",
                    "description": "Token ticker (2..10 characters, letters and digits only)",
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 10,
                    "pattern": "^[a-zA-Z0-9]+$"
                },

                "decimals": {
                    "title": "Decimals",
                    "description": "Token decimals (0..18). Determines token minimal decimal precision",
                    "type": "integer",
                    "default": 0,
                    "minimum": 0,
                    "maximum": 18
                },

                "is_mintable": {
                    "type": "boolean",
                    "default": False,
                    "title": "Is mintable",
                    "description": "Can token owner mint new tokens? In cause of minting new tokens, shares of other holders will be diluted proportionally"
                },

                "max_tokens_count": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 2**63,
                    "default": 100,
                    "title": "Max tokens count",
                    "description": "Max tokens count. Used ONLY for mintable tokens. Leave blank for unlimited tokens minting"
                },

                "premint": {
                    "type": "integer",
                    "default": 100,
                    "minimum": 1,
                    "maximum": 2 ** 63,
                    "title": "Premint tokens",
                    "description": "Premint tokens will be sent to token owner. Leave blank for no premint. If minting disabled - this amount also represent total supply of tokens"
                },
                "is_pausable": {
                    "type": "boolean",
                    "default": False,
                    "title": "Is token pausable?",
                    "description": "Token owner will be able to pause token functions"
                },
            }
        }

        ui_schema = {}

        return {
            "result": "success",
            "schema": json_schema,
            "ui_schema": ui_schema
        }

    def construct(self, fields):
        errors = {}

        parents = []
        constructors_code = ''

        is_capped = fields.get('max_tokens_count') is not None
        is_mintable = fields.get('is_mintable')
        is_pausable = fields.get('is_pausable')

        if is_pausable:
            if is_mintable and is_capped:
                parents.append('PausableCappedDividendToken')
                constructors_code += ' PausableCappedDividendToken({}*10**uint(decimals))'.format(fields['max_tokens_count'])
            elif is_mintable:
                parents.append('PausableMintableDividendToken')
            else:
                parents.append('PausableDividendToken')
        else:
            if is_mintable and is_capped:
                parents.append('CappedDividendToken')
                constructors_code += ' CappedDividendToken({}*10**uint(decimals))'.format(fields['max_tokens_count'])
            elif is_mintable:
                parents.append('MintableDividendToken')
            else:
                pass

        constructor_inner_code = ''
        if fields.get('premint'):
            if fields.get('max_tokens_count') and fields.get('premint') > fields.get('max_tokens_count'):
                errors['premint'] = "Premint count can't be more then maximum tokens count"

            constructor_inner_code = """
                uint premintAmount = {}*10**uint(decimals);
                totalSupply_ = totalSupply_.add(premintAmount);
                balances[msg.sender] = balances[msg.sender].add(premintAmount);
                Transfer(address(0), msg.sender, premintAmount);

                m_emissions.push(EmissionInfo({{
                    totalSupply: totalSupply_,
                    totalBalanceWas: 0
                }}));

            """.format(fields['premint'])

        if errors:
            return {
                "result": "error",
                "errors": errors
            }

        source = self.__class__._TEMPLATE \
            .replace('%name%', fields['name']) \
            .replace('%symbol%', fields['symbol'].upper()) \
            .replace('%decimals%', str(fields['decimals'])) \
            .replace('%parents_code%', ', {}'.format(', '.join(parents)) if parents else '') \
            .replace('%constructors_code%', constructors_code) \
            .replace('%constructor_inner_code%', constructor_inner_code)

        return {
            "result": "success",
            "source": source,
            "contract_name": "Token"
        }

    def post_construct(self, fields, abi_array):

        function_titles = {
            'pause': {
                'title': 'Pause circulation',
                'description': 'Disable any token transfers and minting. Callable only by token owner.',
            },

            'unpause': {
                'title': 'Enable circulation',
                'description': 'Enables token transfers and minting in case they were paused. Callable only by token owner.',
            },

            'mint': {
                'title': 'Mint new tokens',
                'description': 'Creates new tokens out-of-thin-air and gives them to specified address. Callable only by token owner.',
                'inputs': [{
                    'title': 'Address',
                    'description': 'Transfer tokens to this address.',
                }, {
                    'title': 'Amount',
                    'description': 'WARNING!! Amount must be specified in the smallest units of the token (f.e. if you have decimals=2 (like for USD) , then number 1100 in this form means 11.00$. ETH has decimals = 18) ',
                }]
            },

            'finishMinting': {
                'title': 'Finish minting',
                'description': 'Disables any further token creation via minting. Callable only by token owner.',
            },

            'decreaseApproval': {
                'title': 'Decrease approval',
                'description': 'Decreases amount of your tokens which are allowed to be spent by specified address.',
                'inputs': [{
                    'title': 'Address',
                    'description': 'Address which was allowed to spend tokens.',
                }, {
                    'title': 'Amount',
                    'description': 'Amount must be specified in the smallest units of the token.',
                }]
            },

            'increaseApproval': {
                'title': 'Increase approval',
                'description': 'Increases amount of your tokens which are allowed to be spent by specified address.',
                'inputs': [{
                    'title': 'Address',
                    'description': 'Address which was allowed to spend tokens.',
                }, {
                    'title': 'Amount',
                    'description': 'Amount must be specified in the smallest units of the token.',
                }]
            },

            'allowance': {
                'title': 'View allowance',
                'description': 'View amount of tokens which some token holder allowed to spend by another address.',
                'inputs': [{
                    'title': 'Address of owner',
                    'description': 'Address which allowed to spend his tokens.',
                }, {
                    'title': 'Address of spender',
                    'description': 'Address which was allowed to spend tokens.',
                }]
            },

            'approve': {
                'title': 'Approve spending',
                'description': 'Allow some amount of your tokens to be spent by specified address.',
                'inputs': [{
                    'title': 'Address',
                    'description': 'Address to allow to spend tokens.',
                }, {
                    'title': 'Amount',
                    'description': 'Amount must be specified in the smallest units of the token.',
                }]
            },

            'transferFrom': {
                'title': 'Transfer from',
                'description': 'Transfers from one account to another. Account which tokens are transferred has to approve this spending.',
                'inputs': [{
                    'title': 'From',
                    'description': 'Subtract tokens from this account.',
                }, {
                    'title': 'To',
                    'description': 'Transfer tokens to this account.',
                }, {
                    'title': 'Amount',
                    'description': 'Amount must be specified in the smallest units of the token.',
                }]
            },

            'name': {
                'title': 'Token name',
                'description': 'Human-friendly name of the token.',
            },

            'symbol': {
                'title': 'Token ticker',
                'description': 'Abbreviated name of the token used on exchanges etc.',
            },

            'decimals': {
                'title': 'Decimal places',
                'description': 'Allowed digits in fractional part of the token. E.g. decimal places of US dollar is 2.',
            },

            'balanceOf': {
                'title': 'Get balance',
                'description': 'Gets the token balance of any address. Return value is specified in the smallest units of the token.',
                'inputs': [{
                    'title': 'Address',
                }]
            },

            'transfer': {
                'title': 'Transfer tokens',
                'description': 'Transfers some amount of your tokens to another address.',
                'inputs': [{
                    'title': 'To',
                    'description': 'Recipient address.',
                }, {
                    'title': 'Amount',
                    'description': 'Amount must be specified in the smallest units of the token.',
                }]
            },

            'totalSupply': {
                'title': 'Total supply',
                'description': 'Current total amount of the token. Specified in the smallest units of the token.',
            },

            'transferOwnership': {
                'title': 'Transfer ownership',
                'description': 'Transfers ownership of the token to another address. Ownership rights are required to perform some administrative operations.',
                'inputs': [{
                    'title': 'Address',
                    'description': 'Address which\'ll receive ownership rights.',
                }]
            },

            'mintingFinished': {
                'title': 'Minting finished',
                'description': 'If true no more tokens could be created.',
            },

            'cap': {
                'title': 'Maximum tokens',
                'description': 'Maximum number of tokens which could be created. Return value is specified in the smallest units of the token.',
            },

            'paused': {
                'title': 'Paused',
                'description': 'If true any token transfers are disabled.',
            },

            'owner': {
                'title': 'Owner',
                'description': 'Address of the token owner.',
            },

            'm_totalDividends': {
                'title': 'Total amount of dividends',
                'description': 'Total amount of unrequested dividends in contract',
            },

            'm_emissions': {
                'title': 'Get emission info',
                'description': 'Get information about new token emission events. New emission is created each time the tokens are minted',
            },

            'm_lastAccountEmission': {
                'title': 'Get last token emission id for address',
                'description': 'Get information about last token emission to address',
            },

            'm_lastDividends': {
                'title': 'Get last dividends for address',
                'description': 'Get information about last dividends paid to address',
            },

            'm_totalHangingDividends': {
                'title': 'Total amount of hanging dividends',
                'description': 'Total amount of hanging dividends in case when transfer to stakeholder is impossible',
            },

            'requestDividends': {
                'title': 'Request dividends',
                'description': 'Request dividends to be payed to sender. Received dividents are calculated from sender\'s share in total tokens amount during every reveive of ETH by token contract',
            },

            'requestHangingDividends': {
                'title': 'Request hanging dividends',
                'description': 'Internal. Request dividends, that was unable to pay to stakeholder, for example if transfer of ether to stakeholder\'s address was unsuccessful. Haning ether will be returned to contract owner. This function is allowed only for owner.',
            },

            '': {
                'title': 'Deposit',
                'description': 'Transfer ether to contract',
            }
        }

        return {
            "result": "success",
            'function_specs': function_titles,
            'dashboard_functions': ['symbol', 'totalSupply']
        }

    # language=Solidity
    _TEMPLATE = """
pragma solidity ^0.4.24;


/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }
    uint256 c = a * b;
    assert(c / a == b);
    return c;
  }

  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}


/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  function Ownable() public {
    owner = msg.sender;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) public onlyOwner {
    require(newOwner != address(0));
    OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

}

/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
  function totalSupply() public view returns (uint256);
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
  function allowance(address owner, address spender) public view returns (uint256);
  function transferFrom(address from, address to, uint256 value) public returns (bool);
  function approve(address spender, uint256 value) public returns (bool);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}


/**
 * @title Basic token
 * @dev Basic version of StandardToken, with no allowances.
 */
contract BasicToken is ERC20Basic {
  using SafeMath for uint256;

  mapping(address => uint256) balances;

  uint256 totalSupply_;

  /**
  * @dev total number of tokens in existence
  */
  function totalSupply() public view returns (uint256) {
    return totalSupply_;
  }

  /**
  * @dev transfer token for a specified address
  * @param _to The address to transfer to.
  * @param _value The amount to be transferred.
  */
  function transfer(address _to, uint256 _value) public returns (bool) {
    require(_to != address(0));
    require(_value <= balances[msg.sender]);

    // SafeMath.sub will throw if there is not enough balance.
    balances[msg.sender] = balances[msg.sender].sub(_value);
    balances[_to] = balances[_to].add(_value);
    Transfer(msg.sender, _to, _value);
    return true;
  }

  /**
  * @dev Gets the balance of the specified address.
  * @param _owner The address to query the the balance of.
  * @return An uint256 representing the amount owned by the passed address.
  */
  function balanceOf(address _owner) public view returns (uint256 balance) {
    return balances[_owner];
  }

}


/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the basic standard token.
 * @dev https://github.com/ethereum/EIPs/issues/20
 * @dev Based on code by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract StandardToken is ERC20, BasicToken {

  mapping (address => mapping (address => uint256)) internal allowed;


  /**
   * @dev Transfer tokens from one address to another
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amount of tokens to be transferred
   */
  function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
    require(_to != address(0));
    require(_value <= balances[_from]);
    require(_value <= allowed[_from][msg.sender]);

    balances[_from] = balances[_from].sub(_value);
    balances[_to] = balances[_to].add(_value);
    allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
    Transfer(_from, _to, _value);
    return true;
  }

  /**
   * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
   *
   * Beware that changing an allowance with this method brings the risk that someone may use both the old
   * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
   * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
   * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
   * @param _spender The address which will spend the funds.
   * @param _value The amount of tokens to be spent.
   */
  function approve(address _spender, uint256 _value) public returns (bool) {
    allowed[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
    return true;
  }

  /**
   * @dev Function to check the amount of tokens that an owner allowed to a spender.
   * @param _owner address The address which owns the funds.
   * @param _spender address The address which will spend the funds.
   * @return A uint256 specifying the amount of tokens still available for the spender.
   */
  function allowance(address _owner, address _spender) public view returns (uint256) {
    return allowed[_owner][_spender];
  }

  /**
   * @dev Increase the amount of tokens that an owner allowed to a spender.
   *
   * approve should be called when allowed[_spender] == 0. To increment
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _addedValue The amount of tokens to increase the allowance by.
   */
  function increaseApproval(address _spender, uint _addedValue) public returns (bool) {
    allowed[msg.sender][_spender] = allowed[msg.sender][_spender].add(_addedValue);
    Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    return true;
  }

  /**
   * @dev Decrease the amount of tokens that an owner allowed to a spender.
   *
   * approve should be called when allowed[_spender] == 0. To decrement
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _subtractedValue The amount of tokens to decrease the allowance by.
   */
  function decreaseApproval(address _spender, uint _subtractedValue) public returns (bool) {
    uint oldValue = allowed[msg.sender][_spender];
    if (_subtractedValue > oldValue) {
      allowed[msg.sender][_spender] = 0;
    } else {
      allowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
    }
    Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    return true;
  }

}



/**
 * @title Mintable token
 * @dev Simple ERC20 Token example, with mintable token creation
 * @dev Issue: * https://github.com/OpenZeppelin/zeppelin-solidity/issues/120
 * Based on code by TokenMarketNet: https://github.com/TokenMarketNet/ico/blob/master/contracts/MintableToken.sol
 */
contract MintableToken is StandardToken, Ownable {
  event Mint(address indexed to, uint256 amount);
  event MintFinished();

  bool public mintingFinished = false;


  modifier canMint() {
    require(!mintingFinished);
    _;
  }

  /**
   * @dev Function to mint tokens
   * @param _to The address that will receive the minted tokens.
   * @param _amount The amount of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(address _to, uint256 _amount) onlyOwner canMint public returns (bool) {
    totalSupply_ = totalSupply_.add(_amount);
    balances[_to] = balances[_to].add(_amount);
    Mint(_to, _amount);
    Transfer(address(0), _to, _amount);
        
    return true;
  }

  /**
   * @dev Function to stop minting new tokens.
   * @return True if the operation was successful.
   */
  function finishMinting() onlyOwner canMint public returns (bool) {
    mintingFinished = true;
    MintFinished();
    return true;
  }
}


/**
 * @title Pausable
 * @dev Base contract which allows children to implement an emergency stop mechanism.
 */
contract Pausable is Ownable {
  event Pause();
  event Unpause();

  bool public paused = false;


  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenNotPaused() {
    require(!paused);
    _;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is paused.
   */
  modifier whenPaused() {
    require(paused);
    _;
  }

  /**
   * @dev called by the owner to pause, triggers stopped state
   */
  function pause() onlyOwner whenNotPaused public {
    paused = true;
    Pause();
  }

  /**
   * @dev called by the owner to unpause, returns to normal state
   */
  function unpause() onlyOwner whenPaused public {
    paused = false;
    Unpause();
  }
}


contract DividendToken is StandardToken, Ownable {
    event PayDividend(address indexed to, uint256 amount);
    event HangingDividend(address indexed to, uint256 amount) ;
    event PayHangingDividend(uint256 amount) ;
    event Deposit(address indexed sender, uint256 value);

    /// @dev parameters of an extra token emission
    struct EmissionInfo {
        // new totalSupply after emission happened
        uint256 totalSupply;

        // total balance of Ether stored at the contract when emission happened
        uint256 totalBalanceWas;
    }

    constructor () public
    {
        m_emissions.push(EmissionInfo({
            totalSupply: totalSupply(),
            totalBalanceWas: 0
        }));
    }

    function() external payable {
        if (msg.value > 0) {
            emit Deposit(msg.sender, msg.value);
            m_totalDividends = m_totalDividends.add(msg.value);
        }
    }

    /// @notice Request dividends for current account.
    function requestDividends() public {
        payDividendsTo(msg.sender);
    }

    /// @notice Request hanging dividends to pwner.
    function requestHangingDividends() onlyOwner public {
        owner.transfer(m_totalHangingDividends);
        emit PayHangingDividend(m_totalHangingDividends);
        m_totalHangingDividends = 0;
    }

    /// @notice hook on standard ERC20#transfer to pay dividends
    function transfer(address _to, uint256 _value) public returns (bool) {
        payDividendsTo(msg.sender);
        payDividendsTo(_to);
        return super.transfer(_to, _value);
    }

    /// @notice hook on standard ERC20#transferFrom to pay dividends
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        payDividendsTo(_from);
        payDividendsTo(_to);
        return super.transferFrom(_from, _to, _value);
    }

    /// @dev adds dividends to the account _to
    function payDividendsTo(address _to) internal {
        (bool hasNewDividends, uint256 dividends, uint256 lastProcessedEmissionNum) = calculateDividendsFor(_to);
        if (!hasNewDividends)
            return;

        if (0 != dividends) {
            bool res = _to.send(dividends);
            if (res) {
                emit PayDividend(_to, dividends);
            }
            else{
                // _to probably is a contract not able to receive ether
                emit HangingDividend(_to, dividends);
                m_totalHangingDividends = m_totalHangingDividends.add(dividends);
            }
        }

        m_lastAccountEmission[_to] = lastProcessedEmissionNum;
        if (lastProcessedEmissionNum == getLastEmissionNum()) {
            m_lastDividends[_to] = m_totalDividends;
        }
        else {
            m_lastDividends[_to] = m_emissions[lastProcessedEmissionNum.add(1)].totalBalanceWas;
        }
    }

    /// @dev calculates dividends for the account _for
    /// @return (true if state has to be updated, dividend amount (could be 0!), lastProcessedEmissionNum)
    function calculateDividendsFor(address _for) view internal returns (
        bool hasNewDividends,
        uint256 dividends,
        uint256 lastProcessedEmissionNum
    ) {
        uint256 lastEmissionNum = getLastEmissionNum();
        uint256 lastAccountEmissionNum = m_lastAccountEmission[_for];
        assert(lastAccountEmissionNum <= lastEmissionNum);

        uint256 totalBalanceWasWhenLastPay = m_lastDividends[_for];

        assert(m_totalDividends >= totalBalanceWasWhenLastPay);

        // If no new ether was collected since last dividends claim
        if (m_totalDividends == totalBalanceWasWhenLastPay)
            return (false, 0, lastAccountEmissionNum);

        uint256 initialBalance = balances[_for];    // beware of recursion!

        // if no tokens owned by account
        if (0 == initialBalance)
            return (true, 0, lastEmissionNum);

        // We start with last processed emission because some ether could be collected before next emission
        // we pay all remaining ether collected and continue with all the next emissions
        uint256 iter = 0;
        uint256 iterMax = getMaxIterationsForRequestDividends();

        for (uint256 emissionToProcess = lastAccountEmissionNum; emissionToProcess <= lastEmissionNum; emissionToProcess++) {
            if (iter++ > iterMax)
                break;

            lastAccountEmissionNum = emissionToProcess;
            EmissionInfo storage emission = m_emissions[emissionToProcess];

            if (0 == emission.totalSupply)
                continue;

            uint256 totalEtherDuringEmission;
            // last emission we stopped on
            if (emissionToProcess == lastEmissionNum) {
                totalEtherDuringEmission = m_totalDividends.sub(totalBalanceWasWhenLastPay);
            }
            else {
                totalEtherDuringEmission = m_emissions[emissionToProcess.add(1)].totalBalanceWas.sub(totalBalanceWasWhenLastPay);
                totalBalanceWasWhenLastPay = m_emissions[emissionToProcess.add(1)].totalBalanceWas;
            }

            uint256 dividend = totalEtherDuringEmission.mul(initialBalance).div(emission.totalSupply);
            dividends = dividends.add(dividend);
        }

        return (true, dividends, lastAccountEmissionNum);
    }

    function getLastEmissionNum() private view returns (uint256) {
        return m_emissions.length - 1;
    }

    /// @dev to prevent gasLimit problems with many mintings
    function getMaxIterationsForRequestDividends() internal pure returns (uint256) {
        return 200;
    }

    /// @notice record of issued dividend emissions
    EmissionInfo[] public m_emissions;

    /// @dev for each token holder: last emission (index in m_emissions) which was processed for this holder
    mapping(address => uint256) public m_lastAccountEmission;

    /// @dev for each token holder: last ether balance was when requested dividends
    mapping(address => uint256) public m_lastDividends;


    uint256 public m_totalHangingDividends;
    uint256 public m_totalDividends;
}


contract MintableDividendToken is DividendToken, MintableToken {
    event EmissionHappened(uint256 totalSupply, uint256 totalBalanceWas);

    function mint(address _to, uint256 _amount) onlyOwner canMint public returns (bool) {
        payDividendsTo(_to);
        
        bool res = super.mint(_to, _amount);

        m_emissions.push(EmissionInfo({
            totalSupply: totalSupply_,
            totalBalanceWas: m_totalDividends
        }));

        emit EmissionHappened(totalSupply(), m_totalDividends);        
        return res;
    }
}

contract CappedDividendToken is MintableDividendToken {
    uint256 public cap;

    function CappedDividendToken(uint256 _cap) public {
        require(_cap > 0);
        cap = _cap;
    }

    /**
     * @dev Function to mint tokens
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     * @return A boolean that indicates if the operation was successful.
     */
    function mint(address _to, uint256 _amount) onlyOwner canMint public returns (bool) {
        require(totalSupply_.add(_amount) <= cap);
        
        return super.mint(_to, _amount);
    }
}


contract PausableDividendToken is DividendToken, Pausable {
    /// @notice Request dividends for current account.
    function requestDividends() whenNotPaused public {
        super.requestDividends();
    }

    function transfer(address _to, uint256 _value) public whenNotPaused returns (bool) {
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) public whenNotPaused returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    function approve(address _spender, uint256 _value) public whenNotPaused returns (bool) {
        return super.approve(_spender, _value);
    }

    function increaseApproval(address _spender, uint _addedValue) public whenNotPaused returns (bool success) {
        return super.increaseApproval(_spender, _addedValue);
    }
    
    function decreaseApproval(address _spender, uint _subtractedValue) public whenNotPaused returns (bool success) {
        return super.decreaseApproval(_spender, _subtractedValue);
    }    
}


contract PausableMintableDividendToken is PausableDividendToken, MintableDividendToken {
    function mint(address _to, uint256 _amount) whenNotPaused public returns (bool) {
        return super.mint(_to, _amount);
    }
}


contract PausableCappedDividendToken is PausableDividendToken, CappedDividendToken {
    function PausableCappedDividendToken(uint256 _cap) 
        public 
        CappedDividendToken(_cap)
    {
    }
    
    function mint(address _to, uint256 _amount) whenNotPaused public returns (bool) {
        return super.mint(_to, _amount);
    }
}


contract Token is DividendToken %parents_code% {
    string public constant name = '%name%';
    string public constant symbol = '%symbol%';
    uint8 public constant decimals = %decimals%;

    function Token()
        public
        payable
        %constructors_code%
    {
        %constructor_inner_code%
        %payment_code%
    }

}


    """
